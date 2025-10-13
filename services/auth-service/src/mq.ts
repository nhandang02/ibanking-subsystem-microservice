import { connect } from 'amqplib';

let conn: any = null;
let ch: any = null;
let replyQueue = '';

export async function getChannel() {
  if (ch) return { ch, replyQueue };
  const url = process.env.RABBITMQ_URL || `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASS || 'guest'}@rabbitmq:${process.env.RABBITMQ_PORT || 5672}`;
  try {
    conn = await connect(url);
    conn.on?.('error', (err: any) => console.error('[RabbitMQ] connection error', err));
    conn.on?.('close', () => console.warn('[RabbitMQ] connection closed'));
    ch = await conn.createChannel();
    ch.on?.('error', (err: any) => console.error('[RabbitMQ] channel error', err));
    ch.on?.('close', () => console.warn('[RabbitMQ] channel closed'));
    const q = await ch.assertQueue('', { exclusive: true });
    replyQueue = q.queue;
    return { ch, replyQueue };
  } catch (error) {
    console.error('[RabbitMQ] failed to create auth-service channel', error);
    throw error;
  }
}

export async function rpc<T = any>(queue: string, payload: any, timeoutMs = 2000): Promise<T | null> {
  const { ch, replyQueue } = await getChannel();
  const correlationId = Math.random().toString(36).slice(2);
  return new Promise<T | null>(async (resolve) => {
    try {
      const { consumerTag } = await ch.consume(
        replyQueue,
        async (msg: any) => {
          if (!msg) return;
          if (msg.properties.correlationId === correlationId) {
            try {
              const content = JSON.parse(msg.content.toString());
              resolve(content as T);
            } catch {
              resolve(null);
            } finally {
              try { await ch.cancel(consumerTag); } catch {}
            }
          }
        },
        { noAck: true },
      );
      ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
        correlationId,
        replyTo: replyQueue,
        contentType: 'application/json',
      });
      setTimeout(async () => {
        try { await ch.cancel(consumerTag); } catch {}
        resolve(null);
      }, timeoutMs);
    } catch (error) {
      console.error('[RabbitMQ] rpc error', error);
      resolve(null);
    }
  });
}





