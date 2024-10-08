#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod types;

use tauri::Manager;

use async_std::sync::Mutex;
use futures::channel::mpsc;
use futures::SinkExt;
use futures::{select, StreamExt};
use lazy_static::lazy_static;
use libp2p::swarm::SwarmEvent;
use libp2p::Multiaddr;
use libp2p::{gossipsub, noise, tcp, yamux};
use local_ip_address::local_ip;
use std::collections::hash_map::DefaultHasher;
use std::error::Error;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tracing_subscriber::EnvFilter;

static IP_ADDR: OnceLock<Multiaddr> = OnceLock::new();

lazy_static! {
    static ref TX: Mutex<Option<mpsc::Sender<String>>> = Mutex::new(None);
    static ref GLOBAL_WINDOW: Arc<std::sync::Mutex<Option<tauri::Window>>> =
        Arc::new(std::sync::Mutex::new(None));
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_server(String::new()).await {
            eprintln!("Server error: {:?}", e);
        }
    });

    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            let mut global_window = GLOBAL_WINDOW.lock().unwrap();
            *global_window = Some(window);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_window,
            connect_peer,
            send_message,
            get_ip_addr
        ])
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("{}, {argv:?}, {cwd}", app.package_info().name);

            app.emit_all(
                "single-instance",
                types::InstancePayload { args: argv, cwd },
            )
            .unwrap();
        }))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn run_server(ip: String) -> Result<(), Box<dyn Error>> {
    let mut swarm = libp2p::SwarmBuilder::with_new_identity()
        .with_async_std()
        .with_tcp(
            tcp::Config::default(),
            noise::Config::new,
            yamux::Config::default,
        )?
        .with_quic()
        .with_behaviour(|key| {
            let message_id_fn = |message: &gossipsub::Message| {
                let mut s = DefaultHasher::new();
                message.data.hash(&mut s);

                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .expect("Time went backwards... How?")
                    .as_nanos();
                timestamp.hash(&mut s);

                gossipsub::MessageId::from(s.finish().to_string())
            };

            let gossipsub_config = gossipsub::ConfigBuilder::default()
                .heartbeat_interval(Duration::from_secs(5))
                .validation_mode(gossipsub::ValidationMode::Strict)
                .duplicate_cache_time(std::time::Duration::from_secs(0))
                .message_id_fn(message_id_fn)
                .build()?;

            let gossipsub = gossipsub::Behaviour::new(
                gossipsub::MessageAuthenticity::Signed(key.clone()),
                gossipsub_config,
            )?;

            Ok(types::VolvoBehaviour { gossipsub })
        })?
        .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
        .build();

    let topic = gossipsub::IdentTopic::new("VolvoComm");
    swarm.behaviour_mut().gossipsub.subscribe(&topic)?;

    let (tx, mut rx) = mpsc::channel(1);

    {
        let mut tx_lock = TX.lock().await;
        *tx_lock = Some(tx);
    }

    let my_local_ip = local_ip().unwrap();
    swarm.listen_on(format!("/ip4/{}/tcp/0", my_local_ip).parse()?)?;

    if !ip.is_empty() {
        let remote_result = ip.parse::<Multiaddr>();
        match remote_result {
            Ok(remote) => match swarm.dial(remote) {
                Ok(()) => println!("Dialed {}", ip),
                Err(e) => eprintln!("Failed to dial {}: {}", ip, e),
            },
            Err(e) => eprintln!("Failed to parse Multiaddr: {}", e),
        }
    }

    loop {
        select! {
            event = swarm.select_next_some() => match event {
                SwarmEvent::NewListenAddr { address, .. } => {
                    println!("Listening on {address:?}");
                    if IP_ADDR.get().is_none() {
                        IP_ADDR.set(address).expect("Failed to modify IP_ADDR OnceLock.");
                    }
                },
                SwarmEvent::Behaviour(types::VolvoBehaviourEvent::Gossipsub(gossipsub::Event::Message {
                    propagation_source: peer_id,
                    message_id: id,
                    message,
                })) => {
                    println!(
                        "Got message: '{}' with id: {id} from peer: {peer_id}",
                        String::from_utf8_lossy(&message.data),
                    );

                    let window = GLOBAL_WINDOW.lock().unwrap();
                    if let Some(window) = window.as_ref() {
                        window.emit("send_rec_message",  types::RecPayload { message: String::from_utf8_lossy(&message.data).to_string(), sender: peer_id.to_string() } ).unwrap();
                    }
                },
                // SwarmEvent::Behaviour(types::VolvoBehaviourEvent::Gossipsub(gossipsub::Event::Subscribed {
                //     peer_id,
                //     topic
                // })) => {
                //     println!("New Subscription by {peer_id:?} to the {topic:?}");

                //     let window = GLOBAL_WINDOW.lock().unwrap();
                //     if let Some(window) = window.as_ref() {
                //     if let Err(e) = window.emit("message_req", types::ReqPayload {
                //         id: peer_id.to_string()
                //     }) {
                //         eprintln!("Failed to emit message request: {}", e);
                //     }}
                // },
                SwarmEvent::Behaviour(event) => {
                    println!("{event:?}");
                },
                _ => {}
            },
            message = rx.next() => match message {
                Some(msg) => {
                    if let Err(e) = swarm
                    .behaviour_mut().gossipsub
                    .publish(topic.clone(), msg.as_bytes()) {
                        println!("Publish error: {e:?}");
                    }
                },
                None => {}
            }
        }
    }
}

#[tauri::command]
async fn show_window(window: tauri::Window) {
    window.get_window("main").unwrap().show().unwrap();
}

#[tauri::command]
async fn connect_peer(ip: String) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_server(ip).await {
            eprintln!("Server error: {:?}", e);
        }
    });
}

#[tauri::command]
async fn send_message(message: String) {
    let mut tx_lock = TX.lock().await;
    if let Some(tx) = tx_lock.as_mut() {
        tx.send(message).await.unwrap();
    }
}

#[tauri::command]
async fn get_ip_addr() -> String {
    (*IP_ADDR.get().unwrap().to_string()).into()
}
