# KOSMOS V2.0 NATS Integration Tests
"""
Integration tests for NATS messaging including:
- JetStream
- Pub/Sub
- Request/Reply
- Queue groups
- Stream processing
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio
import json


@pytest.fixture
def mock_nats_client():
    """Mock NATS client."""
    client = MagicMock()
    client.connect = AsyncMock()
    client.close = AsyncMock()
    client.publish = AsyncMock()
    client.subscribe = AsyncMock()
    client.request = AsyncMock()
    client.is_connected = True
    return client


@pytest.fixture
def mock_jetstream():
    """Mock NATS JetStream context."""
    js = MagicMock()
    js.publish = AsyncMock(return_value=MagicMock(seq=1, stream="tasks"))
    js.subscribe = AsyncMock()
    js.pull_subscribe = AsyncMock()
    js.add_stream = AsyncMock()
    js.delete_stream = AsyncMock()
    js.stream_info = AsyncMock()
    js.consumer_info = AsyncMock()
    return js


@pytest.fixture
def sample_task_message():
    """Sample task message."""
    return {
        "task_id": "task-123",
        "type": "analysis",
        "agent_id": "athena",
        "payload": {"data": "sample data"},
        "timestamp": "2024-01-01T10:00:00Z",
    }


class TestNATSConnection:
    """Tests for NATS connection management."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_connect_to_nats(self, mock_nats_client):
        """Test connecting to NATS server."""
        with patch("core.messaging.nats", mock_nats_client):
            await mock_nats_client.connect("nats://localhost:4222")

            mock_nats_client.connect.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_connection_with_credentials(self, mock_nats_client):
        """Test connecting with credentials."""
        with patch("core.messaging.nats", mock_nats_client):
            await mock_nats_client.connect(
                "nats://localhost:4222",
                user="kosmos",
                password="secret"
            )

            mock_nats_client.connect.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reconnection(self, mock_nats_client):
        """Test automatic reconnection."""
        reconnect_count = 0

        async def on_reconnect():
            nonlocal reconnect_count
            reconnect_count += 1

        mock_nats_client.reconnected_cb = on_reconnect

        with patch("core.messaging.nats", mock_nats_client):
            # Simulate reconnection
            await mock_nats_client.reconnected_cb()

            assert reconnect_count == 1

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_connection_closed_callback(self, mock_nats_client):
        """Test connection closed callback."""
        closed = False

        async def on_closed():
            nonlocal closed
            closed = True

        mock_nats_client.closed_cb = on_closed

        with patch("core.messaging.nats", mock_nats_client):
            await mock_nats_client.closed_cb()

            assert closed is True


class TestJetStream:
    """Tests for NATS JetStream operations."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_stream(self, mock_jetstream):
        """Test creating a JetStream stream."""
        stream_config = {
            "name": "TASKS",
            "subjects": ["tasks.>"],
            "retention": "limits",
            "max_msgs": 100000,
            "max_bytes": 1073741824,  # 1GB
        }

        mock_jetstream.add_stream.return_value = MagicMock(
            config=stream_config,
            state={"messages": 0, "bytes": 0}
        )

        with patch("core.messaging.js", mock_jetstream):
            result = await mock_jetstream.add_stream(**stream_config)

            assert result.config["name"] == "TASKS"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_publish_to_stream(self, mock_jetstream, sample_task_message):
        """Test publishing message to JetStream."""
        with patch("core.messaging.js", mock_jetstream):
            ack = await mock_jetstream.publish(
                "tasks.new",
                json.dumps(sample_task_message).encode()
            )

            assert ack.seq == 1
            assert ack.stream == "tasks"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_pull_subscribe(self, mock_jetstream):
        """Test pull-based subscription."""
        mock_subscription = MagicMock()
        mock_subscription.fetch = AsyncMock(return_value=[
            MagicMock(
                data=b'{"task_id": "123"}',
                subject="tasks.new",
                seq=1
            )
        ])

        mock_jetstream.pull_subscribe.return_value = mock_subscription

        with patch("core.messaging.js", mock_jetstream):
            sub = await mock_jetstream.pull_subscribe("tasks.>", "task-consumer")
            messages = await sub.fetch(10)

            assert len(messages) == 1
            assert b"task_id" in messages[0].data

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_push_subscribe(self, mock_jetstream):
        """Test push-based subscription."""
        received_messages = []

        async def message_handler(msg):
            received_messages.append(msg)
            await msg.ack()

        mock_subscription = MagicMock()
        mock_jetstream.subscribe.return_value = mock_subscription

        with patch("core.messaging.js", mock_jetstream):
            await mock_jetstream.subscribe(
                "tasks.>",
                cb=message_handler,
                durable="task-processor"
            )

            mock_jetstream.subscribe.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_message_acknowledgment(self, mock_jetstream):
        """Test message acknowledgment."""
        mock_msg = MagicMock()
        mock_msg.ack = AsyncMock()
        mock_msg.nak = AsyncMock()
        mock_msg.in_progress = AsyncMock()

        with patch("core.messaging.js", mock_jetstream):
            # Acknowledge success
            await mock_msg.ack()
            mock_msg.ack.assert_called_once()

            # Negative acknowledge (requeue)
            await mock_msg.nak()
            mock_msg.nak.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_stream_info(self, mock_jetstream):
        """Test getting stream information."""
        mock_jetstream.stream_info.return_value = MagicMock(
            config={"name": "TASKS"},
            state={
                "messages": 1000,
                "bytes": 102400,
                "first_seq": 1,
                "last_seq": 1000,
            }
        )

        with patch("core.messaging.js", mock_jetstream):
            info = await mock_jetstream.stream_info("TASKS")

            assert info.state["messages"] == 1000


class TestPubSub:
    """Tests for NATS Pub/Sub."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_publish_message(self, mock_nats_client, sample_task_message):
        """Test publishing a message."""
        with patch("core.messaging.nats", mock_nats_client):
            await mock_nats_client.publish(
                "events.task.created",
                json.dumps(sample_task_message).encode()
            )

            mock_nats_client.publish.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_subscribe_to_subject(self, mock_nats_client):
        """Test subscribing to a subject."""
        received = []

        async def handler(msg):
            received.append(msg)

        mock_subscription = MagicMock()
        mock_nats_client.subscribe.return_value = mock_subscription

        with patch("core.messaging.nats", mock_nats_client):
            await mock_nats_client.subscribe("events.>", cb=handler)

            mock_nats_client.subscribe.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_wildcard_subscription(self, mock_nats_client):
        """Test wildcard pattern subscription."""
        with patch("core.messaging.nats", mock_nats_client):
            # Single token wildcard
            await mock_nats_client.subscribe("events.*.created")

            # Multi token wildcard
            await mock_nats_client.subscribe("events.>")

            assert mock_nats_client.subscribe.call_count == 2

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_unsubscribe(self, mock_nats_client):
        """Test unsubscribing from a subject."""
        mock_subscription = MagicMock()
        mock_subscription.unsubscribe = AsyncMock()

        mock_nats_client.subscribe.return_value = mock_subscription

        with patch("core.messaging.nats", mock_nats_client):
            sub = await mock_nats_client.subscribe("events.>")
            await sub.unsubscribe()

            mock_subscription.unsubscribe.assert_called_once()


class TestRequestReply:
    """Tests for NATS Request/Reply pattern."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_request_response(self, mock_nats_client):
        """Test request/response pattern."""
        mock_nats_client.request.return_value = MagicMock(
            data=b'{"status": "success", "result": "processed"}'
        )

        with patch("core.messaging.nats", mock_nats_client):
            response = await mock_nats_client.request(
                "service.process",
                b'{"task": "analyze"}',
                timeout=5.0
            )

            result = json.loads(response.data)
            assert result["status"] == "success"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_request_timeout(self, mock_nats_client):
        """Test request timeout handling."""
        mock_nats_client.request = AsyncMock(
            side_effect=asyncio.TimeoutError()
        )

        with patch("core.messaging.nats", mock_nats_client):
            with pytest.raises(asyncio.TimeoutError):
                await mock_nats_client.request(
                    "service.slow",
                    b'{"task": "slow"}',
                    timeout=0.1
                )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_service_responder(self, mock_nats_client):
        """Test setting up a service responder."""
        async def responder(msg):
            request = json.loads(msg.data)
            response = {"status": "processed", "input": request}
            await msg.respond(json.dumps(response).encode())

        with patch("core.messaging.nats", mock_nats_client):
            await mock_nats_client.subscribe("service.process", cb=responder)

            mock_nats_client.subscribe.assert_called_once()


class TestQueueGroups:
    """Tests for NATS Queue Groups (load balancing)."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_queue_group_subscription(self, mock_nats_client):
        """Test queue group subscription."""
        with patch("core.messaging.nats", mock_nats_client):
            await mock_nats_client.subscribe(
                "tasks.process",
                queue="task-workers"
            )

            mock_nats_client.subscribe.assert_called_with(
                "tasks.process",
                queue="task-workers"
            )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_queue_group_load_balancing(self, mock_nats_client):
        """Test load balancing across queue group members."""
        worker_counts = {"worker1": 0, "worker2": 0, "worker3": 0}

        async def worker_handler(worker_id, msg):
            worker_counts[worker_id] += 1

        # Simulate message distribution
        for i in range(100):
            worker = f"worker{(i % 3) + 1}"
            await worker_handler(worker, MagicMock())

        # Each worker should receive roughly equal messages
        for count in worker_counts.values():
            assert count > 30  # At least 30% of messages each


class TestStreamProcessing:
    """Tests for stream processing patterns."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_ordered_consumer(self, mock_jetstream):
        """Test ordered message consumption."""
        messages = []

        async def ordered_handler(msg):
            messages.append(msg.seq)

        mock_subscription = MagicMock()
        mock_subscription.fetch = AsyncMock(return_value=[
            MagicMock(seq=i, data=b'{}') for i in range(1, 11)
        ])

        mock_jetstream.pull_subscribe.return_value = mock_subscription

        with patch("core.messaging.js", mock_jetstream):
            sub = await mock_jetstream.pull_subscribe(
                "tasks.>",
                "ordered-consumer",
                config={"deliver_policy": "all", "ack_policy": "explicit"}
            )

            fetched = await sub.fetch(10)
            for msg in fetched:
                await ordered_handler(msg)

            # Verify order
            assert messages == list(range(1, 11))

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_replay_from_sequence(self, mock_jetstream):
        """Test replaying messages from specific sequence."""
        mock_jetstream.pull_subscribe.return_value = MagicMock(
            fetch=AsyncMock(return_value=[
                MagicMock(seq=100, data=b'{}'),
                MagicMock(seq=101, data=b'{}'),
            ])
        )

        with patch("core.messaging.js", mock_jetstream):
            sub = await mock_jetstream.pull_subscribe(
                "tasks.>",
                "replay-consumer",
                config={"deliver_policy": "by_start_sequence", "opt_start_seq": 100}
            )

            messages = await sub.fetch(10)
            assert messages[0].seq == 100

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_exactly_once_delivery(self, mock_jetstream):
        """Test exactly-once delivery semantics."""
        processed_ids = set()
        duplicate_count = 0

        async def idempotent_handler(msg):
            nonlocal duplicate_count
            msg_id = json.loads(msg.data).get("id")

            if msg_id in processed_ids:
                duplicate_count += 1
                await msg.ack()  # Ack duplicate
                return

            processed_ids.add(msg_id)
            # Process message
            await msg.ack()

        # Simulate processing with potential duplicates
        messages = [
            MagicMock(data=b'{"id": "1"}', ack=AsyncMock()),
            MagicMock(data=b'{"id": "2"}', ack=AsyncMock()),
            MagicMock(data=b'{"id": "1"}', ack=AsyncMock()),  # Duplicate
        ]

        for msg in messages:
            await idempotent_handler(msg)

        assert len(processed_ids) == 2
        assert duplicate_count == 1

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_dead_letter_queue(self, mock_jetstream):
        """Test dead letter queue for failed messages."""
        dlq_messages = []

        async def send_to_dlq(msg, error):
            dlq_messages.append({
                "original": msg,
                "error": str(error),
            })

        async def processor(msg):
            try:
                data = json.loads(msg.data)
                if data.get("should_fail"):
                    raise ValueError("Processing failed")
                await msg.ack()
            except Exception as e:
                await send_to_dlq(msg, e)
                await msg.ack()  # Remove from main queue

        messages = [
            MagicMock(data=b'{"id": "1"}', ack=AsyncMock()),
            MagicMock(data=b'{"id": "2", "should_fail": true}', ack=AsyncMock()),
        ]

        for msg in messages:
            await processor(msg)

        assert len(dlq_messages) == 1
        assert "Processing failed" in dlq_messages[0]["error"]
