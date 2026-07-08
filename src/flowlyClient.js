export async function fetchCompanionProfile({ flowlyApiUrl, companionId, userId }) {
  const baseUrl = String(flowlyApiUrl || "https://flowlyia.com").replace(/\/$/, "");
  const url = new URL(`${baseUrl}/api/companion/profile`);

  if (companionId) url.searchParams.set("companionId", companionId);
  if (userId) url.searchParams.set("userId", userId);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Flow-Companion-Gateway/1.0"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Flowly profile request failed with status ${response.status}`,
        body: text
      };
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: response.status,
        error: "Flowly profile response was not valid JSON",
        body: text
      };
    }

    if (!data?.ok || !data?.companion) {
      return {
        ok: false,
        status: response.status,
        error: "Flowly profile response did not include companion data",
        body: data
      };
    }

    return {
      ok: true,
      status: response.status,
      companion: data.companion
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Unknown Flowly profile request error"
    };
  }
}
