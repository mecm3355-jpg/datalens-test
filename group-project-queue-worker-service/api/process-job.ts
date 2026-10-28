import { handleCallback } from "@vercel/queue";

type JobPayload = {
  job_id: string;
};

export const POST = handleCallback<JobPayload>(async (payload, metadata) => {
  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  const workerSecret = process.env.QUEUE_WORKER_SECRET;
  if (!backendUrl || !workerSecret) {
    throw new Error("Queue worker configuration is incomplete.");
  }
  if (!payload.job_id || !/^[0-9a-f]{24}$/iu.test(payload.job_id)) {
    throw new Error("Queue message contains an invalid job ID.");
  }

  const url = new URL(
    `/internal/queue/jobs/${encodeURIComponent(payload.job_id)}`,
    backendUrl,
  );
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-queue-worker-secret": workerSecret,
    },
    body: JSON.stringify({ deliveryCount: metadata.deliveryCount }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Backend job execution failed (${response.status}): ${detail}`);
  }
});
