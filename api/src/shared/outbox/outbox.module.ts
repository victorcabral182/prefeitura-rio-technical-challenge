import { Module } from '@nestjs/common';
import { OutboxRelay } from './outbox-relay.js';
import { RabbitMqPublisher } from './rabbitmq-publisher.js';

@Module({ providers: [OutboxRelay, RabbitMqPublisher] })
export class OutboxModule {}
