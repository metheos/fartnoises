import { io, Socket } from "socket.io-client";

interface TestResult {
  test: string;
  passed: boolean;
  details?: string;
}

class MultiplayerFixesTester {
  private socket1: Socket;
  private socket2: Socket;
  private socket3: Socket;
  private results: TestResult[] = [];
  private roomCode: string = "";

  constructor() {
    // Initialize sockets for 3 players
    this.socket1 = io("http://localhost:3000", { path: "/api/socket" });
    this.socket2 = io("http://localhost:3000", { path: "/api/socket" });
    this.socket3 = io("http://localhost:3000", { path: "/api/socket" });
  }

  private addResult(test: string, passed: boolean, details?: string) {
    this.results.push({ test, passed, details });
    console.log(
      `${passed ? "✅" : "❌"} ${test}${details ? ` - ${details}` : ""}`
    );
  }

  private waitForEvent(
    socket: Socket,
    event: string,
    timeout = 5000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event}`));
      }, timeout);

      socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async testPromptSelectionTimer(): Promise<void> {
    console.log("\n🧪 Testing Prompt Selection Timer...");

    try {
      // Start the game
      this.socket1.emit("startGame");

      // Wait for prompt selection phase
      const promptData = await this.waitForEvent(
        this.socket1,
        "gameStateChanged"
      );

      if (promptData && promptData.timeLimit) {
        this.addResult(
          "Prompt Selection Timer Init",
          true,
          `Time limit: ${promptData.timeLimit}s`
        );
      } else {
        this.addResult(
          "Prompt Selection Timer Init",
          false,
          "No time limit provided"
        );
      }

      // Wait for time updates
      let timeUpdateReceived = false;
      this.socket1.on("timeUpdate", (data) => {
        if (data.timeLeft !== undefined) {
          timeUpdateReceived = true;
          console.log(`⏰ Time update: ${data.timeLeft}s remaining`);
        }
      });

      await this.delay(2000); // Wait 2 seconds for time updates
      this.addResult(
        "Prompt Timer Updates",
        timeUpdateReceived,
        "Real-time countdown working"
      );
    } catch (error) {
      this.addResult("Prompt Selection Timer", false, error.message);
    }
  }

  async testSoundSelectionTimer(): Promise<void> {
    console.log("\n🧪 Testing Sound Selection Timer...");

    try {
      // Select a prompt to move to sound selection
      this.socket1.emit("selectPrompt", "prompt_1");

      // Wait for sound selection phase
      const soundData = await this.waitForEvent(
        this.socket1,
        "gameStateChanged"
      );

      if (soundData && soundData.timeLimit) {
        this.addResult(
          "Sound Selection Timer Init",
          true,
          `Time limit: ${soundData.timeLimit}s`
        );
      } else {
        this.addResult(
          "Sound Selection Timer Init",
          false,
          "No time limit provided"
        );
      }

      // Check for timer updates
      let soundTimerUpdates = 0;
      this.socket1.on("timeUpdate", (data) => {
        if (data.timeLeft !== undefined) {
          soundTimerUpdates++;
        }
      });

      await this.delay(3000);
      this.addResult(
        "Sound Timer Updates",
        soundTimerUpdates > 0,
        `Received ${soundTimerUpdates} updates`
      );
    } catch (error) {
      this.addResult("Sound Selection Timer", false, error.message);
    }
  }

  async testReducedPlaybackDelay(): Promise<void> {
    console.log("\n🧪 Testing Reduced Playback Delay...");

    try {
      // Submit sounds from all non-judge players
      this.socket2.emit("submitSounds", ["fart1", "burp"]);
      this.socket3.emit("submitSounds", ["goat", "laser"]);

      const playbackStart = Date.now();

      // Wait for playback phase
      await this.waitForEvent(this.socket1, "gameStateChanged");

      // Wait for judging phase (should happen faster now)
      await this.waitForEvent(this.socket1, "gameStateChanged");

      const totalTime = Date.now() - playbackStart;
      const expectedOldTime = 2 * 3000 + 2000; // Old formula: 8 seconds
      const expectedNewTime = 2 * 1500 + 1000; // New formula: 4 seconds

      this.addResult(
        "Reduced Playback Delay",
        totalTime < expectedOldTime,
        `Transition took ${totalTime}ms (expected < ${expectedOldTime}ms)`
      );
    } catch (error) {
      this.addResult("Reduced Playback Delay", false, error.message);
    }
  }

  async testWinnerDisplay(): Promise<void> {
    console.log("\n🧪 Testing Winner Display...");

    try {
      // Judge selects a winner
      this.socket1.emit("selectWinner", "0");

      // Wait for round complete event
      const winnerData = await this.waitForEvent(this.socket1, "roundComplete");

      const hasWinnerId = winnerData && winnerData.winnerId;
      const hasWinnerName = winnerData && winnerData.winnerName;
      const hasWinningSubmission = winnerData && winnerData.winningSubmission;
      const hasSubmissionIndex =
        winnerData && winnerData.submissionIndex !== undefined;

      this.addResult(
        "Winner Data Structure",
        hasWinnerId &&
          hasWinnerName &&
          hasWinningSubmission &&
          hasSubmissionIndex,
        `Contains: ${[
          hasWinnerId && "winnerId",
          hasWinnerName && "winnerName",
          hasWinningSubmission && "winningSubmission",
          hasSubmissionIndex && "submissionIndex",
        ]
          .filter(Boolean)
          .join(", ")}`
      );

      // Check if all players receive the winner data
      let player2ReceivedWinner = false;
      let player3ReceivedWinner = false;

      this.socket2.once("roundComplete", () => {
        player2ReceivedWinner = true;
      });
      this.socket3.once("roundComplete", () => {
        player3ReceivedWinner = true;
      });

      await this.delay(1000);

      this.addResult(
        "Winner Broadcast",
        player2ReceivedWinner && player3ReceivedWinner,
        `Player 2: ${player2ReceivedWinner}, Player 3: ${player3ReceivedWinner}`
      );
    } catch (error) {
      this.addResult("Winner Display", false, error.message);
    }
  }

  async runAllTests(): Promise<void> {
    console.log("🚀 Starting Multiplayer Fixes Test Suite\n");
    console.log("==========================================");

    try {
      // Setup: Create room and join players
      console.log("\n🔧 Setting up test environment...");

      await new Promise<void>((resolve) => {
        this.socket1.emit("createRoom", "TestHost", (roomCode: string) => {
          this.roomCode = roomCode;
          console.log(`✅ Room created: ${roomCode}`);
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        this.socket2.emit("joinRoom", this.roomCode, "TestPlayer2", () => {
          console.log("✅ Player 2 joined");
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        this.socket3.emit("joinRoom", this.roomCode, "TestPlayer3", () => {
          console.log("✅ Player 3 joined");
          resolve();
        });
      });

      // Run tests
      await this.testPromptSelectionTimer();
      await this.testSoundSelectionTimer();
      await this.testReducedPlaybackDelay();
      await this.testWinnerDisplay();
    } catch (error) {
      console.error("❌ Test setup failed:", error.message);
    }

    // Print results
    console.log("\n==========================================");
    console.log("📊 TEST RESULTS SUMMARY");
    console.log("==========================================");

    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    this.results.forEach((result) => {
      console.log(`${result.passed ? "✅" : "❌"} ${result.test}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });

    console.log(`\n📈 Score: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log("🎉 All multiplayer fixes are working correctly!");
    } else {
      console.log("⚠️  Some issues remain. Check the failed tests above.");
    }

    // Cleanup
    this.cleanup();
  }

  private cleanup(): void {
    console.log("\n🧹 Cleaning up...");
    this.socket1.disconnect();
    this.socket2.disconnect();
    this.socket3.disconnect();
  }
}

// Run the tests
const tester = new MultiplayerFixesTester();
tester.runAllTests().catch(console.error);
