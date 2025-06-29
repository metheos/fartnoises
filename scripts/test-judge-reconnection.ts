/**
 * Test script specifically for judge reconnection behavior
 *
 * This script tests that when a judge disconnects and other players vote to wait,
 * the judge role is preserved for when the judge reconnects.
 *
 * Usage: npx ts-node scripts/test-judge-reconnection.ts
 */

import { io, Socket } from "socket.io-client";
import { GameState } from "../src/types/game";

// Test configuration
const SERVER_URL = "http://localhost:3000";
const SOCKET_PATH = "/api/socket";
const TEST_TIMEOUT = 120000; // 120 seconds

interface TestPlayer {
  socket: Socket;
  name: string;
  id: string;
  isConnected: boolean;
  roomCode?: string;
  originalId?: string;
  isJudge?: boolean;
}

class JudgeReconnectionTester {
  private players: TestPlayer[] = [];
  private roomCode: string = "";
  private testResults: { [key: string]: boolean } = {};
  private currentTest: string = "";

  constructor() {
    // Set a test timeout
    setTimeout(() => {
      console.log("❌ Test suite timeout reached");
      this.cleanup();
      process.exit(1);
    }, TEST_TIMEOUT);
  }

  private log(message: string, isError: boolean = false) {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
    const prefix = isError ? "❌" : "🔍";
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  private success(message: string) {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
    console.log(`✅ [${timestamp}] ${message}`);
  }

  private startTest(testName: string) {
    this.currentTest = testName;
    console.log(`\n🎯 Starting: ${testName}`);
  }

  private passTest(testName: string) {
    this.testResults[testName] = true;
    this.success(`PASSED: ${testName}`);
  }

  private failTest(testName: string, reason: string) {
    this.testResults[testName] = false;
    this.log(`FAILED: ${testName} - ${reason}`, true);
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

      // Track judge selection events
      socket.on("judgeSelected", (judgeId) => {
        this.log(`Judge selected: ${judgeId} (${name} sees this)`);
        player.isJudge = player.id === judgeId;
      });

      socket.on("gameStateChanged", (gameState) => {
        this.log(`Game state changed to: ${gameState} (${name} sees this)`);
      });

      socket.on("playerDisconnected", (data) => {
        this.log(`${name} received playerDisconnected: ${data.playerName}`);
      });

      socket.on("gamePausedForDisconnection", (data) => {
        this.log(
          `${name} received gamePausedForDisconnection: ${data.disconnectedPlayerName}`
        );
      });

      socket.on("reconnectionVoteRequest", (data) => {
        this.log(
          `${name} received vote request for ${data.disconnectedPlayerName}`
        );
        // Vote to WAIT for the judge (false = wait longer)
        setTimeout(() => {
          socket.emit("voteOnReconnection", false);
          this.log(`${name} voted to WAIT for disconnected player`);
        }, 1000);
      });

      socket.on("reconnectionVoteResult", (data) => {
        this.log(
          `${name} received vote result: ${
            data.continueWithoutPlayer ? "continue" : "wait"
          } for ${data.disconnectedPlayerName}`
        );
      });

      socket.on("playerReconnected", (data) => {
        this.log(`${name} received playerReconnected: ${data.playerName}`);
      });

      socket.on("gameResumed", () => {
        this.log(`${name} received gameResumed event`);
      });

      this.players.push(player);
    });
  }

  private async createRoom(hostPlayer: TestPlayer): Promise<string> {
    return new Promise((resolve, reject) => {
      const playerData = {
        name: hostPlayer.name,
        color: "#FF6B6B",
        emoji: "🎮",
      };

      hostPlayer.socket.emit("createRoom", playerData, (roomCode: string) => {
        if (roomCode) {
          this.roomCode = roomCode;
          hostPlayer.roomCode = roomCode;
          this.log(`Room created: ${roomCode}`);
          resolve(roomCode);
        } else {
          reject(new Error("Failed to create room"));
        }
      });
    });
  }

  private async joinRoom(
    player: TestPlayer,
    roomCode: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const playerData = {
        name: player.name,
        color: "#4ECDC4", // Different color for non-host players
        emoji: "🎯",
      };

      player.socket.emit(
        "joinRoom",
        roomCode,
        playerData,
        (success: boolean) => {
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

  // Test: Setup game and identify judge
  private async testGameSetup(): Promise<void> {
    this.startTest("Game Setup and Judge Identification");

    try {
      // Create 3 players
      const host = await this.createPlayer("TestHost");
      const player1 = await this.createPlayer("TestPlayer1");
      const player2 = await this.createPlayer("TestPlayer2");

      await this.createRoom(host);
      await this.joinRoom(player1, this.roomCode);
      await this.joinRoom(player2, this.roomCode);

      await this.startGame(host);
      await this.sleep(3000); // Wait for judge selection

      // Find who is the judge
      const judge = this.players.find((p) => p.isJudge);
      if (judge) {
        this.log(`Judge identified: ${judge.name} (${judge.id})`);
        this.passTest("Game Setup and Judge Identification");
      } else {
        this.failTest("Game Setup and Judge Identification", "No judge found");
      }
    } catch (error) {
      this.failTest(
        "Game Setup and Judge Identification",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Test: Judge disconnects and others vote to wait
  private async testJudgeDisconnectionWithWaitVote(): Promise<void> {
    this.startTest("Judge Disconnection with Wait Vote");

    try {
      const judge = this.players.find((p) => p.isJudge);
      if (!judge) {
        throw new Error("No judge found");
      }

      const originalJudgeId = judge.id;
      judge.originalId = originalJudgeId;

      let votingOccurred = false;
      let gameResumed = false;
      let voteResult: string = "";

      // Set up listeners on non-judge players
      this.players
        .filter((p) => !p.isJudge)
        .forEach((player) => {
          player.socket.once("reconnectionVoteRequest", () => {
            votingOccurred = true;
            this.log(
              `${player.name} received vote request - setting votingOccurred to true`
            );
          });

          player.socket.once("reconnectionVoteResult", (data) => {
            voteResult = data.continueWithoutPlayer ? "continue" : "wait";
            this.log(`${player.name} received vote result: ${voteResult}`);
          });

          player.socket.once("gameResumed", () => {
            gameResumed = true;
            this.log(
              `${player.name} received gameResumed - setting gameResumed to true`
            );
          });
        });

      this.log(`Disconnecting judge: ${judge.name} (${judge.id})`);
      judge.socket.disconnect();

      // Wait for voting process (30s grace + 20s vote + buffer)
      // Since players vote to "wait", the game should restart the timer again
      this.log("Waiting for disconnection handling and voting process...");
      await this.sleep(55000); // Wait for initial voting

      // Check if voting occurred and had the right result
      if (votingOccurred && voteResult === "wait") {
        this.log(
          `Voting phase completed correctly - players voted to "${voteResult}"`
        );
        this.passTest("Judge Disconnection with Wait Vote");
      } else {
        this.failTest(
          "Judge Disconnection with Wait Vote",
          `Voting: ${votingOccurred}, Vote result: ${voteResult}, Game resumed: ${gameResumed}`
        );
      }
    } catch (error) {
      this.failTest(
        "Judge Disconnection with Wait Vote",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Test: Judge reconnects and retains role
  private async testJudgeReconnectionAndRoleRetention(): Promise<void> {
    this.startTest("Judge Reconnection and Role Retention");

    try {
      const disconnectedJudge = this.players.find((p) => p.originalId);
      if (!disconnectedJudge || !disconnectedJudge.originalId) {
        throw new Error("Disconnected judge not found");
      }

      // Create new socket for reconnection
      const newSocket = io(SERVER_URL, {
        path: SOCKET_PATH,
        transports: ["polling", "websocket"],
        forceNew: true,
      });

      let reconnectionSuccess = false;
      let judgeRolePreserved = false;
      let roomState: any = null;

      newSocket.on("connect", () => {
        this.log(`Judge reconnection socket connected: ${newSocket.id}`);

        // Attempt reconnection
        newSocket.emit(
          "reconnectToRoom",
          this.roomCode,
          disconnectedJudge.name,
          disconnectedJudge.originalId,
          (success: boolean) => {
            if (success) {
              this.log("Judge reconnection successful");
              reconnectionSuccess = true;
              disconnectedJudge.socket = newSocket;
              disconnectedJudge.id = newSocket.id || "";
              disconnectedJudge.isConnected = true;
            } else {
              this.log("Judge reconnection failed", true);
            }
          }
        );
      });

      // Check if judge role is preserved after reconnection
      newSocket.on("judgeSelected", (judgeId) => {
        this.log(`Judge selected after reconnection: ${judgeId}`);
        if (judgeId === newSocket.id) {
          judgeRolePreserved = true;
          this.log(
            "Judge role preserved successfully via judgeSelected event!"
          );
        }
      });

      // Also check room state - this is the most reliable way
      newSocket.on("roomJoined", ({ room, player }) => {
        roomState = room;
        this.log(
          `Judge reconnected to room. Current judge: ${room.currentJudge}, Reconnected player ID: ${player.id}`
        );

        if (room && room.currentJudge === player.id) {
          judgeRolePreserved = true;
          this.log("Judge role confirmed in room state!");
        } else if (room && room.currentJudge) {
          this.log(
            `Judge role NOT preserved - current judge is ${room.currentJudge}, but reconnected player is ${player.id}`,
            true
          );
        } else {
          this.log("No current judge found in room state", true);
        }
      });

      // Also listen for room updates
      newSocket.on("roomUpdated", (room) => {
        this.log(
          `Room updated. Current judge: ${room.currentJudge}, Reconnected player ID: ${newSocket.id}`
        );
        if (room && room.currentJudge === newSocket.id) {
          judgeRolePreserved = true;
          this.log("Judge role confirmed via room update!");
        }
      });

      // Wait for reconnection attempt
      await this.sleep(10000);

      this.log(
        `Final status: Reconnection: ${reconnectionSuccess}, Role preserved: ${judgeRolePreserved}`
      );
      if (roomState) {
        this.log(
          `Final room state - Current judge: ${roomState.currentJudge}, Player count: ${roomState.players?.length}`
        );
      }

      if (reconnectionSuccess && judgeRolePreserved) {
        this.passTest("Judge Reconnection and Role Retention");
      } else {
        this.failTest(
          "Judge Reconnection and Role Retention",
          `Reconnection: ${reconnectionSuccess}, Role preserved: ${judgeRolePreserved}`
        );
      }
    } catch (error) {
      this.failTest(
        "Judge Reconnection and Role Retention",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Test: Quick reconnection during grace period (should not pause game)
  private async testQuickReconnection(): Promise<void> {
    this.startTest("Quick Reconnection During Grace Period");

    try {
      const judge = this.players.find((p) => p.isJudge);
      if (!judge) {
        throw new Error("No judge found");
      }

      const originalJudgeId = judge.id;
      let gamePaused = false;
      let playerReconnected = false;

      // Set up listeners on other players to detect if game gets paused
      this.players
        .filter((p) => !p.isJudge)
        .forEach((player) => {
          player.socket.once("gamePausedForDisconnection", () => {
            gamePaused = true;
            this.log(`Game was paused - grace period test FAILED`);
          });

          player.socket.once("playerReconnected", (data) => {
            if (data.playerName === judge.name) {
              playerReconnected = true;
              this.log(
                `${player.name} received playerReconnected for ${data.playerName}`
              );
            }
          });
        });

      this.log(`Disconnecting judge briefly: ${judge.name} (${judge.id})`);
      judge.socket.disconnect();

      // Wait 5 seconds (less than 10-second grace period)
      await this.sleep(5000);

      // Create new socket for quick reconnection
      const newSocket = io(SERVER_URL, {
        path: SOCKET_PATH,
        transports: ["polling", "websocket"],
        forceNew: true,
      });

      let reconnectionSuccess = false;

      newSocket.on("connect", () => {
        this.log(`Quick reconnection socket connected: ${newSocket.id}`);

        // Attempt reconnection
        newSocket.emit(
          "reconnectToRoom",
          this.roomCode,
          judge.name,
          originalJudgeId,
          (success: boolean) => {
            if (success) {
              this.log("Quick reconnection successful");
              reconnectionSuccess = true;
              judge.socket = newSocket;
              judge.id = newSocket.id || "";
              judge.isConnected = true;
            } else {
              this.log("Quick reconnection failed", true);
            }
          }
        );
      });

      // Wait a bit more to see if game gets paused
      await this.sleep(3000);

      // Check results
      if (reconnectionSuccess && !gamePaused && playerReconnected) {
        this.log("✅ Quick reconnection successful without pausing game!");
        this.passTest("Quick Reconnection During Grace Period");
      } else {
        this.failTest(
          "Quick Reconnection During Grace Period",
          `Reconnection: ${reconnectionSuccess}, Game paused: ${gamePaused}, Player reconnected event: ${playerReconnected}`
        );
      }
    } catch (error) {
      this.failTest(
        "Quick Reconnection During Grace Period",
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
    console.log("📊 JUDGE RECONNECTION TEST RESULTS");
    console.log("=".repeat(50));

    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(
      (result) => result
    ).length;

    Object.entries(this.testResults).forEach(([testName, passed]) => {
      console.log(`${passed ? "✅" : "❌"} ${testName}`);
    });

    console.log("=".repeat(50));
    console.log(`📈 Final Score: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests) {
      console.log("🎉 All tests passed! Judge reconnection works correctly.");
    } else {
      console.log("⚠️  Some tests failed. Check the logs above for details.");
    }
  }

  public async runAllTests(): Promise<void> {
    try {
      this.log("=== STARTING JUDGE RECONNECTION TEST SEQUENCE ===");

      this.log("Phase 1: Game Setup and Judge Identification");
      await this.testGameSetup();
      await this.sleep(2000);

      this.log("Phase 2: Test Grace Period (Quick Reconnection)");
      await this.testQuickReconnection();
      await this.sleep(2000);

      this.log("Phase 3: Judge Disconnection with Wait Vote");
      await this.testJudgeDisconnectionWithWaitVote();
      await this.sleep(2000);

      this.log("Phase 4: Judge Reconnection and Role Retention");
      await this.testJudgeReconnectionAndRoleRetention();

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
  const tester = new JudgeReconnectionTester();
  await tester.runAllTests();
  process.exit(0);
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Test interrupted by user");
  process.exit(0);
});

main().catch((error) => {
  console.error("❌ Test execution failed:", error);
  process.exit(1);
});
