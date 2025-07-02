// Test script to verify canInitialize behavior

// Simulate the current flawed implementation
function currentCanInitialize(): boolean {
  try {
    // Check if we're in a browser environment
    if (typeof window === "undefined") return false;

    // Current flawed logic: create temp context to check state
    const tempContext = new (window.AudioContext ||
      (window as any).webkitAudioContext ||
      AudioContext)();

    const canInit = tempContext.state === "running";
    console.log(
      `Temp AudioContext state: ${tempContext.state}, canInit: ${canInit}`
    );

    // Clean up
    tempContext.close();

    return canInit;
  } catch (error) {
    console.log("AudioContext creation failed:", error);
    return false;
  }
}

// Improved implementation that checks for user interaction
function improvedCanInitialize(): boolean {
  try {
    // Check if we're in a browser environment
    if (typeof window === "undefined") return false;

    // Check if user has interacted with the document
    // Modern browsers require user interaction before audio can play
    const hasUserInteracted =
      document.visibilityState === "visible" &&
      (document.hasFocus() ||
        document.body.classList.contains("user-has-interacted"));

    // Additional checks for user interaction indicators
    const interactionIndicators = [
      // Check if any click/touch events have been registered
      document.body.dataset.userInteracted === "true",
      // Check if we're in full screen (indicates user interaction)
      document.fullscreenElement !== null,
      // Check if page is focused and visible
      document.hasFocus() && document.visibilityState === "visible",
    ];

    const hasInteraction =
      hasUserInteracted || interactionIndicators.some(Boolean);

    console.log(`User interaction detected: ${hasInteraction}`);
    console.log(`Document visibility: ${document.visibilityState}`);
    console.log(`Document has focus: ${document.hasFocus()}`);

    return hasInteraction;
  } catch (error) {
    console.log("Interaction check failed:", error);
    return false;
  }
}

// Test both implementations
console.log("=== Testing canInitialize implementations ===");
console.log("Current implementation result:", currentCanInitialize());
console.log("Improved implementation result:", improvedCanInitialize());

// Test creating an actual AudioContext to see its behavior
console.log("\n=== Testing actual AudioContext behavior ===");
try {
  const testContext = new AudioContext();
  console.log(`New AudioContext state: ${testContext.state}`);

  // Try to resume it (this would fail without user interaction)
  testContext
    .resume()
    .then(() => {
      console.log(
        `AudioContext state after resume attempt: ${testContext.state}`
      );
    })
    .catch((error) => {
      console.log(
        `Resume failed (expected without user interaction):`,
        error.message
      );
    });

  // Clean up
  setTimeout(() => testContext.close(), 100);
} catch (error) {
  console.log("Failed to create test AudioContext:", error);
}
