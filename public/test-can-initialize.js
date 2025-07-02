console.log("=== Testing canInitialize() behavior ===");

// Import the AudioSystem (this would normally be imported)
// For testing, we'll access it from the global scope if available
// or create test scenarios

function testCanInitializeBehavior() {
  console.log("\n📊 Audio System canInitialize() Verification Test");
  console.log("================================================");

  // Test 1: Check browser environment
  console.log("\n1. Environment Check:");
  console.log(`- typeof window: ${typeof window}`);
  console.log(`- typeof document: ${typeof document}`);

  if (typeof window === "undefined") {
    console.log("❌ Not in browser environment");
    return;
  }

  // Test 2: Check AudioContext availability
  console.log("\n2. AudioContext Availability:");
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  console.log(`- AudioContext available: ${!!AudioContextClass}`);

  if (!AudioContextClass) {
    console.log("❌ AudioContext not supported");
    return;
  }

  // Test 3: Document state
  console.log("\n3. Document State:");
  console.log(`- Document ready state: ${document.readyState}`);
  console.log(`- Document visibility: ${document.visibilityState}`);
  console.log(`- Document has focus: ${document.hasFocus()}`);
  console.log(`- Document hidden: ${document.hidden}`);

  // Test 4: User interaction indicators
  console.log("\n4. User Interaction Indicators:");
  console.log(
    `- Body dataset.userInteracted: ${document.body.dataset.userInteracted}`
  );
  console.log(
    `- Body has 'user-has-interacted' class: ${document.body.classList.contains(
      "user-has-interacted"
    )}`
  );
  console.log(`- Fullscreen element: ${!!document.fullscreenElement}`);

  // Test 5: Create AudioContext to see its initial state
  console.log("\n5. AudioContext Initial State Test:");
  try {
    const testContext = new AudioContextClass();
    console.log(`- New AudioContext state: ${testContext.state}`);
    console.log(`- Sample rate: ${testContext.sampleRate}Hz`);

    // Try to resume it
    testContext
      .resume()
      .then(() => {
        console.log(
          `✅ AudioContext resumed successfully, state: ${testContext.state}`
        );
      })
      .catch((error) => {
        console.log(`❌ AudioContext resume failed: ${error.message}`);
      })
      .finally(() => {
        // Clean up
        setTimeout(() => testContext.close(), 100);
      });
  } catch (error) {
    console.log(`❌ Failed to create AudioContext: ${error}`);
  }

  // Test 6: Development environment check
  console.log("\n6. Environment Variables:");
  console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`- Is development: ${process.env.NODE_ENV === "development"}`);

  // Test 7: Final canInitialize logic simulation
  console.log("\n7. canInitialize Logic Simulation:");

  const userInteractionChecks = [
    document.hasFocus() && document.visibilityState === "visible",
    document.body.dataset.userInteracted === "true",
    document.fullscreenElement !== null,
    document.body.classList.contains("user-has-interacted"),
    document.readyState === "complete" && document.hasFocus(),
  ];

  const hasUserInteraction = userInteractionChecks.some(Boolean);
  const isDevelopment = process.env.NODE_ENV === "development";
  const pageIsActive =
    document.visibilityState === "visible" && !document.hidden;
  const canInitialize = hasUserInteraction || (isDevelopment && pageIsActive);

  console.log(
    `- User interaction checks: [${userInteractionChecks
      .map((c) => (c ? "✓" : "✗"))
      .join(", ")}]`
  );
  console.log(`- Has user interaction: ${hasUserInteraction}`);
  console.log(`- Is development: ${isDevelopment}`);
  console.log(`- Page is active: ${pageIsActive}`);
  console.log(`🎯 Final canInitialize result: ${canInitialize}`);

  return canInitialize;
}

// Run the test
testCanInitializeBehavior();

// Add click listener to mark interaction and retest
document.addEventListener(
  "click",
  () => {
    console.log("\n🖱️ Click detected - marking user interaction...");
    document.body.dataset.userInteracted = "true";
    document.body.classList.add("user-has-interacted");

    setTimeout(() => {
      console.log("\n📊 Re-testing after user interaction:");
      testCanInitializeBehavior();
    }, 100);
  },
  { once: true }
);

console.log(
  "\n👆 Click anywhere on the page to test user interaction detection..."
);
