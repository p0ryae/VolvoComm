use libp2p::{gossipsub, swarm::NetworkBehaviour};

#[derive(NetworkBehaviour)]
pub struct VolvoBehaviour {
    pub gossipsub: gossipsub::Behaviour,
}

#[derive(Clone, serde::Serialize)]
pub struct RecPayload {
    pub message: String,
    pub sender: String,
}

#[derive(Clone, serde::Serialize)]
pub struct InstancePayload {
    pub args: Vec<String>,
    pub cwd: String,
}
