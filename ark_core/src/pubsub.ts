// Pub/Sub is optional — gracefully no-ops when GCP isn't configured
let pubsubClient: any = null;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    const { PubSub } = require("@google-cloud/pubsub");
    pubsubClient = new PubSub();
    console.log("[Pub/Sub] Client initialized.");
  }
} catch (e) {
  console.warn("[Pub/Sub] Unavailable — skipping:", (e as Error).message);
}

const RAW_EVENTS_TOPIC = "ark-raw-events";
const CORRELATED_REPORTS_TOPIC = "ark-correlated-reports";

export async function publishRawEvent(data: unknown) {
  return publishToTopic(RAW_EVENTS_TOPIC, data);
}

export async function publishCorrelatedReport(data: unknown) {
  return publishToTopic(CORRELATED_REPORTS_TOPIC, data);
}

async function publishToTopic(topicName: string, data: unknown) {
  if (!pubsubClient) return; // GCP not configured — silent no-op
  try {
    const dataBuffer = Buffer.from(JSON.stringify(data));
    const messageId = await pubsubClient.topic(topicName).publishMessage({ data: dataBuffer });
    console.log(`[Pub/Sub] Message ${messageId} published to ${topicName}`);
    return messageId;
  } catch (err) {
    console.error(`[Pub/Sub Error] Failed to publish to ${topicName}:`, err);
  }
}
