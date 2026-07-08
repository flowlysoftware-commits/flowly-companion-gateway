export function buildUnityActionsFromRuntime(runtime, eventType = "runtime.updated") {
  const state = runtime?.state?.current || "idle";
  const emotion = runtime?.emotion?.mood || "neutral";

  const actions = [
    {
      type: "brain.state.apply",
      state
    },
    {
      type: "emotion.apply",
      emotion
    }
  ];

  if (eventType === "companion.response.started") {
    actions.push({ type: "reaction.trigger", reaction: "ResponseStarted" });
  }

  if (eventType === "companion.response.finished") {
    actions.push({ type: "reaction.trigger", reaction: "ResponseFinished" });
  }

  return actions;
}
