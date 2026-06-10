import { PubSub } from "@google-cloud/pubsub";

const pubsub = new PubSub();

const RAW_EVENTS_TOPIC = "ark-raw-events";
const CORRELATED_REPORTS_TOPIC = "ark-correlated-reports";

export async function publishRawEvent(data: any) {
  return publishToTopic(RAW_EVENTS_TOPIC, data);
}

export async function publishCorrelatedReport(data: any) {
  return publishToTopic(CORRELATED_REPORTS_TOPIC, data);
}

async function publishToTopic(topicName: string, data: any) {
  try {
    const dataBuffer = Buffer.from(JSON.stringify(data));
    const messageId = await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
    console.log(`[Pub/Sub] Message ${messageId} published to ${topicName}`);
    return messageId;
  } catch (err) {
    console.error(`[Pub/Sub Error] Failed to publish to ${topicName}:`, err);
    // Silent fail for demo purposes if GCP isn't configured
  }
}
