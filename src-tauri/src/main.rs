#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use async_std::io::prelude::BufReadExt;
use async_std::io::{stdin, BufReader};
use futures::StreamExt;
use libp2p::swarm::SwarmEvent;
use libp2p::Multiaddr;
use libp2p::{gossipsub, noise, swarm::NetworkBehaviour, tcp, yamux};
use std::collections::hash_map::DefaultHasher;
use std::error::Error;
use std::hash::{Hash, Hasher};
use std::time::Duration;
use tauri::Manager;
use tracing_subscriber::EnvFilter;

#[derive(NetworkBehaviour)]
struct MyBehaviour {
    gossipsub: gossipsub::Behaviour,
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
        .invoke_handler(tauri::generate_handler![show_window, connect_peer])
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
                gossipsub::MessageId::from(s.finish().to_string())
            };

            let gossipsub_config = gossipsub::ConfigBuilder::default()
                .heartbeat_interval(Duration::from_secs(10))
                .validation_mode(gossipsub::ValidationMode::Strict)
                .message_id_fn(message_id_fn)
                .build()?;

            let gossipsub = gossipsub::Behaviour::new(
                gossipsub::MessageAuthenticity::Signed(key.clone()),
                gossipsub_config,
            )?;

            Ok(MyBehaviour { gossipsub })
        })?
        .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
        .build();

    let topic = gossipsub::IdentTopic::new("VolvoComm");
    swarm.behaviour_mut().gossipsub.subscribe(&topic)?;

    let mut _stdin = BufReader::new(stdin()).lines();

    swarm.listen_on("/ip4/0.0.0.0/udp/0/quic-v1".parse()?)?;
    swarm.listen_on("/ip4/0.0.0.0/tcp/0".parse()?)?;

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
        match swarm.select_next_some().await {
            SwarmEvent::NewListenAddr { address, .. } => println!("Listening on {address:?}"),
            SwarmEvent::Behaviour(event) => println!("{event:?}"),
            _ => {}
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
