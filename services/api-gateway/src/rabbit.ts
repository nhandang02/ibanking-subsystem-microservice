import { connect } from 'amqplib';

let conn: any = null;
let ch: any = null;

export async function getChannel() {
  if (ch) return ch;
  const url = process.env.RABBITMQ_URL || `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASS || 'guest'}@rabbitmq:${process.env.RABBITMQ_PORT || 5672}`;
  try {
    conn = await connect(url);
    conn.on?.('error', (err: any) => console.error('[RabbitMQ] connection error', err));
    conn.on?.('close', () => console.warn('[RabbitMQ] connection closed'));
    ch = await conn.createChannel();
    ch.on?.('error', (err: any) => console.error('[RabbitMQ] channel error', err));
    ch.on?.('close', () => console.warn('[RabbitMQ] channel closed'));
    return ch;
  } catch (error) {
    console.error('[RabbitMQ] failed to create channel', error);
    throw error;
  }
}

