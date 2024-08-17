#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures::prelude::*;
use libp2p::swarm::SwarmEvent;
use libp2p::{ping, Multiaddr};
use std::error::Error;
use std::time::Duration;
use tauri::Manager;
use tracing_subscriber::EnvFilter;

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

async fn run_server(ip: String) -> Result<libp2p::Swarm<ping::Behaviour>, Box<dyn Error>> {
    let mut swarm = libp2p::SwarmBuilder::with_new_identity()
        .with_async_std()
        .with_tcp(
            libp2p::tcp::Config::default(),
            libp2p::tls::Config::new,
            libp2p::yamux::Config::default,
        )?
        .with_behaviour(|_| ping::Behaviour::default())?
        .with_swarm_config(|cfg| cfg.with_idle_connection_timeout(Duration::from_secs(u64::MAX))) // Allows us to observe pings indefinitely.
        .build();

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
            SwarmEvent::NewListenAddr { address, .. } => {
                println!("Listening on {address:?}");
            }
            SwarmEvent::Behaviour(event) => {
                println!("Received event: {event:?}");
            }
            SwarmEvent::ConnectionEstablished { peer_id, .. } => {
                println!("Connection established with peer: {peer_id}");
            }
            SwarmEvent::ConnectionClosed { peer_id, cause, .. } => {
                println!("Connection closed with peer: {peer_id}, cause: {cause:?}");
            }
            _ => {
                println!("Other event received");
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
