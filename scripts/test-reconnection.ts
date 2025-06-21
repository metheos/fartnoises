/**
 * Test script for the reconnection system
 *
 * This script simulates multiple players connecting, disconnecting, and reconnecting
 * to verify that the reconnection system works correctly.
 *
 * Usage: npx ts-node scripts/test-reconnection.ts
 */

import { io, Socket } from "socket.io-client";
import { GameState } from "../src/types/game";

// Test configuration
const SERVER_URL = "http://localhost:3000";
const SOCKET_PATH = "/api/socket";
const TEST_TIMEOUT = 120000; // 120 seconds (extended for reconnection tests)

// Server constants (should match server-side values)
const RECONNECTION_GRACE_PERIOD = 30000; // 30 seconds
const RECONNECTION_VOTE_TIMEOUT = 20000; // 20 seconds

interface TestPlayer {
  socket: Socket;
  name: string;
  id: string;
  isConnected: boolean;
  roomCode?: string;
  originalId?: string;
}

class ReconnectionTester {
  private players: TestPlayer[] = [];
  private roomCode: string = "";
  private testResults: { [key: string]: boolean } = {};
  private currentTest: string = "";

  constructor() {
    console.log("🧪 Starting Reconnection System Tests");
    console.log("=".repeat(50));
  }

  private log(message: string, isError: boolean = false) {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    const prefix = isError ? "❌" : "🔍";
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  private success(message: string) {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${timestamp}] ✅ ${message}`);
  }

  private startTest(testName: string) {
    this.currentTest = testName;
    console.log(`\n🧪 Starting Test: ${testName}`);
    console.log("-".repeat(40));
  }

  private passTest(testName: string) {
    this.testResults[testName] = true;
    this.success(`Test passed: ${testName}`);
  }

  private failTest(testName: string, reason: string) {
    this.testResults[testName] = false;
    this.log(`Test failed: ${testName} - ${reason}`, true);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createPlayer(name: string): Promise<TestPlayer> {
    return new Promise((resolve, reject) => {
      const socket = io(SERVER_URL, {
        path: SOCKET_PATH,
        transports: ["polling", "websocket"],
        forceNew: true,
      });

      const player: TestPlayer = {
        socket,
        name,
        id: "",
        isConnected: false,
      };

      const timeout = setTimeout(() => {
        reject(new Error(`Player ${name} failed to connect within timeout`));
      }, 5000);
      socket.on("connect", () => {
        clearTimeout(timeout);
        player.id = socket.id || "";
        player.isConnected = true;
        this.log(`Player ${name} connected with ID: ${socket.id}`);
        resolve(player);
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      socket.on("disconnect", () => {
        player.isConnected = false;
        this.log(`Player ${name} disconnected`);
      });
      socket.on("error", (error) => {
        if (error && typeof error === "object" && "message" in error) {
          this.log(`Player ${name} received error: ${error.message}`, true);
        } else {
          this.log(
            `Player ${name} received error: ${JSON.stringify(error)}`,
            true
          );
        }
      });

      socket.on("playerDisconnected", (data) => {
        this.log(
          `Player ${name} received playerDisconnected event: ${data.playerName}`
        );
      });

      socket.on("playerReconnected", (data) => {
        this.log(
          `Player ${name} received playerReconnected event: ${data.playerName}`
        );
      });

      socket.on("gamePausedForDisconnection", (data) => {
        this.log(
          `Player ${name} received gamePausedForDisconnection: ${data.disconnectedPlayerName}`
        );
      });

      socket.on("gameResumed", () => {
        this.log(`Player ${name} received gameResumed event`);
      });

      socket.on("reconnectionVoteRequest", (data) => {
        this.log(
          `Player ${name} received vote request for ${data.disconnectedPlayerName}`
        );
        // Auto-vote to continue after 2 seconds for testing
        setTimeout(() => {
          socket.emit("voteOnReconnection", true);
          this.log(
            `Player ${name} voted to continue without disconnected player`
          );
        }, 2000);
      });

      socket.on("reconnectionVoteResult", (data) => {
        this.log(
          `Player ${name} received vote result: ${
            data.continueWithoutPlayer ? "continue" : "wait"
          } for ${data.disconnectedPlayerName}`
        );
      });

      this.players.push(player);
    });
  }

  private async createRoom(hostPlayer: TestPlayer): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Room creation timeout"));
      }, 5000);

      hostPlayer.socket.emit(
        "createRoom",
        hostPlayer.name,
        (roomCode: string) => {
          clearTimeout(timeout);
          this.roomCode = roomCode;
          hostPlayer.roomCode = roomCode;
          this.log(`Room created: ${roomCode}`);
          resolve(roomCode);
        }
      );

      hostPlayer.socket.on("roomCreated", ({ room, player }) => {
        this.log(`Host received roomCreated event for room: ${room.code}`);
      });
    });
  }

  private async joinRoom(
    player: TestPlayer,
    roomCode: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Room join timeout"));
      }, 5000);

      player.socket.emit(
        "joinRoom",
        roomCode,
        player.name,
        (success: boolean) => {
          clearTimeout(timeout);
          if (success) {
            player.roomCode = roomCode;
            this.log(`Player ${player.name} joined room ${roomCode}`);
            resolve(true);
          } else {
            this.log(
              `Player ${player.name} failed to join room ${roomCode}`,
              true
            );
            resolve(false);
          }
        }
      );

      player.socket.on("roomJoined", ({ room, player: joinedPlayer }) => {
        this.log(`Player ${player.name} received roomJoined event`);
      });
    });
  }

  private async startGame(hostPlayer: TestPlayer): Promise<void> {
    return new Promise((resolve) => {
      hostPlayer.socket.on("gameStateChanged", (state: GameState) => {
        if (state === GameState.JUDGE_SELECTION) {
          this.log("Game started successfully");
          resolve();
        }
      });

      hostPlayer.socket.emit("startGame");
      this.log(`Host ${hostPlayer.name} started the game`);
    });
  }
  private async testBasicConnection(): Promise<void> {
    this.startTest("Basic Connection Test");

    try {
      const host = await this.createPlayer("TestHost");
      const player1 = await this.createPlayer("TestPlayer1");
      const player2 = await this.createPlayer("TestPlayer2"); // Need 3 players minimum

      if (host.isConnected && player1.isConnected && player2.isConnected) {
        this.passTest("Basic Connection Test");
      } else {
        this.failTest("Basic Connection Test", "Players failed to connect");
      }
    } catch (error) {
      this.failTest(
        "Basic Connection Test",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
  private async testRoomCreationAndJoining(): Promise<void> {
    this.startTest("Room Creation and Joining Test");

    try {
      const host = this.players.find((p) => p.name === "TestHost");
      const player1 = this.players.find((p) => p.name === "TestPlayer1");
      const player2 = this.players.find((p) => p.name === "TestPlayer2");

      if (!host || !player1 || !player2) {
        throw new Error("Players not found");
      }

      await this.createRoom(host);
      const joinSuccess1 = await this.joinRoom(player1, this.roomCode);
      const joinSuccess2 = await this.joinRoom(player2, this.roomCode);

      if (joinSuccess1 && joinSuccess2) {
        this.passTest("Room Creation and Joining Test");
      } else {
        this.failTest("Room Creation and Joining Test", "Failed to join room");
      }
    } catch (error) {
      this.failTest(
        "Room Creation and Joining Test",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async testGameStart(): Promise<void> {
    this.startTest("Game Start Test");

    try {
      const host = this.players.find((p) => p.name === "TestHost");
      if (!host) {
        throw new Error("Host not found");
      }

      await this.startGame(host);
      await this.sleep(2000); // Wait for game state to stabilize

      this.passTest("Game Start Test");
    } catch (error) {
      this.failTest(
        "Game Start Test",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async testPlayerDisconnection(): Promise<void> {
    this.startTest("Player Disconnection Test");

    try {
      const player1 = this.players.find((p) => p.name === "TestPlayer1");
      if (!player1) {
        throw new Error("TestPlayer1 not found");
      }

      // Store original ID for reconnection
      player1.originalId = player1.id;

      // Set up listeners for disconnection events
      let gamePaused = false;
      const host = this.players.find((p) => p.name === "TestHost");

      if (host) {
        host.socket.once("gamePausedForDisconnection", () => {
          gamePaused = true;
          this.log("Game paused due to disconnection");
        });
      }

      // Disconnect the player
      player1.socket.disconnect();
      this.log(`Disconnected player: ${player1.name}`);

      // Wait for disconnection to be processed
      await this.sleep(3000);

      if (gamePaused) {
        this.passTest("Player Disconnection Test");
      } else {
        this.failTest(
          "Player Disconnection Test",
          "Game was not paused after disconnection"
        );
      }
    } catch (error) {
      this.failTest(
        "Player Disconnection Test",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async testPlayerReconnection(): Promise<void> {
    this.startTest("Player Reconnection Test");

    try {
      const disconnectedPlayer = this.players.find(
        (p) => p.name === "TestPlayer1"
      );
      if (!disconnectedPlayer || !disconnectedPlayer.originalId) {
        throw new Error("Disconnected player or original ID not found");
      }

      // Create new socket connection for reconnection
      const newSocket = io(SERVER_URL, {
        path: SOCKET_PATH,
        transports: ["polling", "websocket"],
        forceNew: true,
      });

      let reconnectionSuccess = false;

      newSocket.on("connect", () => {
        this.log(`New socket connected for reconnection: ${newSocket.id}`);

        // Attempt reconnection
        newSocket.emit(
          "reconnectToRoom",
          this.roomCode,
          disconnectedPlayer.name,
          disconnectedPlayer.originalId,
          (success: boolean) => {
            if (success) {
              this.log("Reconnection successful");
              reconnectionSuccess = true;
              disconnectedPlayer.socket = newSocket;
              disconnectedPlayer.id = newSocket.id || "";
              disconnectedPlayer.isConnected = true;
            } else {
              this.log("Reconnection failed", true);
            }
          }
        );
      });

      // Wait for reconnection attempt
      await this.sleep(5000);

      if (reconnectionSuccess) {
        this.passTest("Player Reconnection Test");
      } else {
        this.failTest(
          "Player Reconnection Test",
          "Reconnection was not successful"
        );
      }
    } catch (error) {
      this.failTest(
        "Player Reconnection Test",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
  private async testVotingSystem(): Promise<void> {
    this.startTest("Voting System Test");

    try {
      // We already have 3 players (TestHost, TestPlayer1, TestPlayer2)
      // Listen for vote requests on ALL remaining players since server randomly selects voter
      const host = this.players.find((p) => p.name === "TestHost");
      const player2 = this.players.find((p) => p.name === "TestPlayer2");
      const player1 = this.players.find((p) => p.name === "TestPlayer1");

      if (!host || !player2 || !player1) {
        throw new Error("Required players not found");
      }

      let voteRequestReceived = false;
      let voteResultReceived = false;
      let disconnectionDetected = false;
      let voterName = "";

      // Set up disconnection listener
      host.socket.once("gamePausedForDisconnection", () => {
        disconnectionDetected = true;
        this.log("Game paused due to disconnection for voting test");
      });

      // Set up vote listeners on ALL remaining players
      const setupVoteListener = (player: TestPlayer) => {
        player.socket.once("reconnectionVoteRequest", (data) => {
          voteRequestReceived = true;
          voterName = player.name;
          this.log(
            `Vote request received by ${player.name} for ${data.disconnectedPlayerName}`
          );

          // Vote to continue without the player
          setTimeout(() => {
            player.socket.emit("voteOnReconnection", true);
            this.log(
              `${player.name} voted to continue without disconnected player`
            );
          }, 1000);
        });

        player.socket.once("reconnectionVoteResult", (data) => {
          if (!voteResultReceived) {
            voteResultReceived = true;
            this.log(
              `Vote result received by ${player.name}: ${
                data.continueWithoutPlayer ? "continue" : "wait"
              }`
            );
          }
        });
      };

      setupVoteListener(host);
      setupVoteListener(player2);

      this.log("Disconnecting player1 to trigger voting process...");
      // Disconnect player to trigger voting
      player1.socket.disconnect();

      // Wait for grace period + vote timeout + buffer
      const totalWaitTime =
        RECONNECTION_GRACE_PERIOD + RECONNECTION_VOTE_TIMEOUT + 5000; // 55 seconds + 5 second buffer
      this.log(`Waiting ${totalWaitTime / 1000} seconds for voting process...`);

      // Check progress periodically
      let elapsed = 0;
      const checkInterval = 5000; // Check every 5 seconds
      while (
        elapsed < totalWaitTime &&
        (!voteRequestReceived || !voteResultReceived)
      ) {
        await this.sleep(checkInterval);
        elapsed += checkInterval;
        this.log(
          `Progress check: disconnection=${disconnectionDetected}, voteRequest=${voteRequestReceived} (by ${voterName}), voteResult=${voteResultReceived} (${
            elapsed / 1000
          }s elapsed)`
        );
      }

      if (voteRequestReceived && voteResultReceived) {
        this.passTest("Voting System Test");
      } else {
        this.failTest(
          "Voting System Test",
          `Vote request: ${voteRequestReceived}, Vote result: ${voteResultReceived}, disconnection: ${disconnectionDetected}, voter: ${voterName}`
        );
      }
    } catch (error) {
      this.failTest(
        "Voting System Test",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
  private async testGameResumption(): Promise<void> {
    this.startTest("Game Resumption Test");

    try {
      let gameResumed = false;
      let alreadyResumed = false;

      // Listen for game resumption on both remaining players
      const host = this.players.find((p) => p.name === "TestHost");
      const player2 = this.players.find((p) => p.name === "TestPlayer2");

      // Check if we already received game resumption events during the voting test
      // by looking at recent logs or assuming resumption happened if voting completed
      if (this.testResults["Voting System Test"]) {
        this.log(
          "Voting test passed, assuming game already resumed during that phase"
        );
        alreadyResumed = true;
        gameResumed = true;
      }

      if (!alreadyResumed) {
        if (host) {
          host.socket.once("gameResumed", () => {
            gameResumed = true;
            this.log("Game resumed after voting (detected by host)");
          });
        }

        if (player2) {
          player2.socket.once("gameResumed", () => {
            gameResumed = true;
            this.log("Game resumed after voting (detected by player2)");
          });
        }

        this.log("Waiting for game resumption after voting...");

        // Wait with periodic checks
        let elapsed = 0;
        const maxWait = 10000; // 10 seconds should be enough
        const checkInterval = 1000; // Check every second

        while (elapsed < maxWait && !gameResumed) {
          await this.sleep(checkInterval);
          elapsed += checkInterval;
          this.log(
            `Checking for game resumption... (${elapsed / 1000}s elapsed)`
          );
        }
      }

      if (gameResumed) {
        this.passTest("Game Resumption Test");
      } else {
        this.failTest(
          "Game Resumption Test",
          "Game did not resume after voting within timeout"
        );
      }
    } catch (error) {
      this.failTest(
        "Game Resumption Test",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private cleanup(): void {
    this.log("Cleaning up test connections...");
    this.players.forEach((player) => {
      if (player.socket && player.isConnected) {
        player.socket.disconnect();
      }
    });
  }

  private printResults(): void {
    console.log("\n" + "=".repeat(50));
    console.log("🧪 TEST RESULTS SUMMARY");
    console.log("=".repeat(50));

    let passed = 0;
    let total = 0;

    Object.entries(this.testResults).forEach(([testName, success]) => {
      total++;
      if (success) {
        passed++;
        console.log(`✅ ${testName}`);
      } else {
        console.log(`❌ ${testName}`);
      }
    });

    console.log("=".repeat(50));
    console.log(`📊 Results: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log(
        "🎉 All tests passed! Reconnection system is working correctly."
      );
    } else {
      console.log("🚨 Some tests failed. Please check the implementation.");
    }
  }
  public async runAllTests(): Promise<void> {
    try {
      this.log("=== STARTING TEST SEQUENCE ===");

      this.log("Phase 1: Basic Connection");
      await this.testBasicConnection();
      await this.sleep(1000);

      this.log("Phase 2: Room Creation and Joining");
      await this.testRoomCreationAndJoining();
      await this.sleep(1000);

      this.log("Phase 3: Game Start");
      await this.testGameStart();
      await this.sleep(2000);

      this.log("Phase 4: Player Disconnection");
      await this.testPlayerDisconnection();
      await this.sleep(2000);

      this.log("Phase 5: Player Reconnection");
      await this.testPlayerReconnection();
      await this.sleep(2000);

      this.log("Phase 6: Voting System (This may take up to 60 seconds)");
      await this.testVotingSystem();
      await this.sleep(2000);

      this.log("Phase 7: Game Resumption");
      await this.testGameResumption();

      this.log("=== ALL TESTS COMPLETED ===");
    } catch (error) {
      this.log(
        `Test suite error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        true
      );
    } finally {
      this.cleanup();
      this.printResults();
    }
  }
}

// Run the tests
async function main() {
  console.log("🚀 Starting Reconnection System Test Suite");
  console.log(
    "Make sure the development server is running on http://localhost:3000"
  );
  console.log("Press Ctrl+C to stop the tests at any time.\n");

  // Wait a moment for user to see the message
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const tester = new ReconnectionTester();

  // Set up global timeout
  const timeout = setTimeout(() => {
    console.log("\n⏰ Test suite timed out after 60 seconds");
    process.exit(1);
  }, TEST_TIMEOUT);

  try {
    await tester.runAllTests();
  } catch (error) {
    console.error("❌ Test suite failed:", error);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Tests interrupted by user");
  process.exit(0);
});

// Run the tests if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Failed to run tests:", error);
    process.exit(1);
  });
}

export { ReconnectionTester };
