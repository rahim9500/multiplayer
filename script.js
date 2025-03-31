document.addEventListener('DOMContentLoaded', () => {
    // Game state
    const state = {
        peer: null,
        peerId: null,
        connections: [],
        isHost: false,
        roomCode: null,
        username: '',
        players: [],
        gameStarted: false,
        imposterIndex: -1,
        animeCharacter: null,
    };

    // Anime characters list (you can add more)
    const animeCharacters = [
        { name: "Naruto Uzumaki", image: "https://via.placeholder.com/300x300.png?text=Naruto" },
        { name: "Monkey D. Luffy", image: "https://via.placeholder.com/300x300.png?text=Luffy" },
        { name: "Goku", image: "https://via.placeholder.com/300x300.png?text=Goku" },
        { name: "Sailor Moon", image: "https://via.placeholder.com/300x300.png?text=Sailor+Moon" },
        { name: "Spike Spiegel", image: "https://via.placeholder.com/300x300.png?text=Spike" },
        { name: "Mikasa Ackerman", image: "https://via.placeholder.com/300x300.png?text=Mikasa" },
        { name: "Light Yagami", image: "https://via.placeholder.com/300x300.png?text=Light" },
        { name: "Inuyasha", image: "https://via.placeholder.com/300x300.png?text=Inuyasha" }
    ];

    // DOM Elements
    const setupScreen = document.getElementById('setup-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    const createGameBtn = document.getElementById('create-game');
    const joinGameBtn = document.getElementById('join-game');
    const startGameBtn = document.getElementById('start-game');
    const backToLobbyBtn = document.getElementById('back-to-lobby');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const playersList = document.getElementById('players');
    const hostControls = document.getElementById('host-controls');
    const waitingMessage = document.getElementById('waiting-message');
    const roleInfo = document.getElementById('role-info');

    function initializePeer() {
        state.peer = new Peer({
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },  
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            }
        });
    
        state.peer.on('open', (id) => {
            state.peerId = id;
            console.log('My peer ID is: ' + id);
        });
    
        state.peer.on('connection', (conn) => {
            handleNewConnection(conn);
        });
    }
    
    

    // Create a new game room
    createGameBtn.addEventListener('click', () => {
        const usernameInput = document.getElementById('username-create');
        if (!usernameInput.value.trim()) {
            alert('Please enter a nickname');
            return;
        }

        state.username = usernameInput.value.trim();
        state.isHost = true;
        state.roomCode = generateRoomCode();
        
        // Add host to players list
        state.players.push({
            id: state.peerId,
            username: state.username,
            isHost: true
        });

        // Show lobby screen
        setupScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        hostControls.classList.remove('hidden');
        waitingMessage.classList.add('hidden');
        
        // Display room code
        roomCodeDisplay.textContent = state.roomCode;
        
        // Update players list
        updatePlayersList();
    });

    // Join an existing game
    joinGameBtn.addEventListener('click', () => {
        const roomCodeInput = document.getElementById('room-code');
        const usernameInput = document.getElementById('username-join');
        
        if (!roomCodeInput.value.trim() || !usernameInput.value.trim()) {
            alert('Please enter both room code and nickname');
            return;
        }

        state.roomCode = roomCodeInput.value.trim();
        state.username = usernameInput.value.trim();
        
        // Connect to host - the room code should be the host's peer ID
        const conn = state.peer.connect(state.roomCode, {
            metadata: {
                username: state.username,
                isJoining: true
            }
        });

        conn.on('open', () => {
            // Send join request
            conn.send({
                type: 'join',
                username: state.username,
                id: state.peerId
            });
            
            state.connections.push(conn);
            
            // Show lobby screen
            setupScreen.classList.add('hidden');
            lobbyScreen.classList.remove('hidden');
            
            // Display room code
            roomCodeDisplay.textContent = state.roomCode;
        });

        conn.on('data', (data) => {
            handleMessage(conn, data);
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            alert('Failed to connect to the game room');
        });
    });

    // Start the game (host only)
    startGameBtn.addEventListener('click', () => {
        if (!state.isHost) return;
        if (state.players.length < 3) {
            alert('Need at least 3 players to start');
            return;
        }

        // Select random imposter
        state.imposterIndex = Math.floor(Math.random() * state.players.length);
        
        // Select random anime character
        state.animeCharacter = animeCharacters[Math.floor(Math.random() * animeCharacters.length)];
        
        // Send game start message to all players
        state.connections.forEach((conn, index) => {
            const playerIndex = state.players.findIndex(p => p.id === conn.peer);
            const isImposter = playerIndex === state.imposterIndex;
            
            conn.send({
                type: 'gameStart',
                isImposter: isImposter,
                animeCharacter: isImposter ? null : state.animeCharacter
            });
        });
        
        // Host's own game screen - check if host is imposter
        const hostIsImposter = state.imposterIndex === 0;
        displayGameScreen(hostIsImposter, hostIsImposter ? null : state.animeCharacter);
    });

    // Back to lobby button
    backToLobbyBtn.addEventListener('click', () => {
        gameScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        
        if (state.isHost) {
            // Send everyone back to lobby
            state.connections.forEach(conn => {
                conn.send({
                    type: 'backToLobby'
                });
            });
        }
    });

    // Handle new peer connection
    function handleNewConnection(conn) {
        console.log('New connection from:', conn.peer);
        
        conn.on('open', () => {
            state.connections.push(conn);
            
            conn.on('data', (data) => {
                handleMessage(conn, data);
            });
        });
        
        conn.on('close', () => {
            // Remove connection
            const index = state.connections.findIndex(c => c.peer === conn.peer);
            if (index !== -1) {
                state.connections.splice(index, 1);
            }
            
            // Remove player
            const playerIndex = state.players.findIndex(p => p.id === conn.peer);
            if (playerIndex !== -1) {
                state.players.splice(playerIndex, 1);
                updatePlayersList();
                
                // Broadcast player list update
                broadcastPlayers();
            }
        });
    }

    // Handle incoming messages
    function handleMessage(conn, data) {
        console.log('Received message:', data);
        
        switch (data.type) {
            case 'join':
                if (state.isHost) {
                    // Add new player
                    state.players.push({
                        id: data.id,
                        username: data.username,
                        isHost: false
                    });
                    
                    updatePlayersList();
                    
                    // Update start game button
                    startGameBtn.disabled = state.players.length < 3;
                    
                    // Send current player list to the new player
                    conn.send({
                        type: 'playersList',
                        players: state.players
                    });
                    
                    // Broadcast updated player list to all
                    broadcastPlayers();
                }
                break;
                
            case 'playersList':
                if (!state.isHost) {
                    state.players = data.players;
                    updatePlayersList();
                }
                break;
                
            case 'gameStart':
                if (!state.isHost) {
                    displayGameScreen(data.isImposter, data.animeCharacter);
                }
                break;
                
            case 'backToLobby':
                if (!state.isHost) {
                    gameScreen.classList.add('hidden');
                    lobbyScreen.classList.remove('hidden');
                }
                break;
        }
    }

    // Display game screen with role information
    function displayGameScreen(isImposter, character) {
        lobbyScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        
        roleInfo.innerHTML = '';
        
        if (isImposter) {
            const message = document.createElement('div');
            message.className = 'role-message imposter';
            message.textContent = 'You are the IMPOSTER!';
            roleInfo.appendChild(message);
            
            const description = document.createElement('p');
            description.textContent = 'Try to blend in with the other players! They all received the same anime character.';
            roleInfo.appendChild(description);
        } else {
            const message = document.createElement('div');
            message.className = 'role-message normal-player';
            message.textContent = 'You are a NORMAL PLAYER!';
            roleInfo.appendChild(message);
            
            const characterName = document.createElement('h3');
            characterName.textContent = `Your character: ${character.name}`;
            roleInfo.appendChild(characterName);
            
            const characterImage = document.createElement('img');
            characterImage.src = character.image;
            characterImage.alt = character.name;
            characterImage.className = 'anime-character';
            roleInfo.appendChild(characterImage);
            
            const description = document.createElement('p');
            description.textContent = 'Everyone except the imposter received this character. Try to figure out who the imposter is!';
            roleInfo.appendChild(description);
        }
    }

    // Update the players list in the UI
    function updatePlayersList() {
        playersList.innerHTML = '';
        
        state.players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player.username + (player.isHost ? ' (Host)' : '');
            playersList.appendChild(li);
        });
        
        if (state.isHost) {
            startGameBtn.disabled = state.players.length < 3;
        }
    }

    // Broadcast players list to all connections
    function broadcastPlayers() {
        if (!state.isHost) return;
        
        state.connections.forEach(conn => {
            conn.send({
                type: 'playersList',
                players: state.players
            });
        });
    }

    // Generate a simple room code (using peer ID for simplicity)
    function generateRoomCode() {
        return state.peerId;
    }

    // Initialize on page load
    initializePeer();
});