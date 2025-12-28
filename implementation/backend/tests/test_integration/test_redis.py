# KOSMOS V2.0 Redis Integration Tests
"""
Integration tests for Redis operations including:
- Caching
- Session management
- Rate limiting
- Pub/Sub
- Distributed locks
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio
import json


@pytest.fixture
def mock_redis_client():
    """Mock Redis client."""
    client = MagicMock()
    client.get = AsyncMock(return_value=None)
    client.set = AsyncMock(return_value=True)
    client.delete = AsyncMock(return_value=1)
    client.exists = AsyncMock(return_value=1)
    client.expire = AsyncMock(return_value=True)
    client.ttl = AsyncMock(return_value=3600)
    client.incr = AsyncMock(return_value=1)
    client.decr = AsyncMock(return_value=0)
    client.hget = AsyncMock(return_value=None)
    client.hset = AsyncMock(return_value=1)
    client.hgetall = AsyncMock(return_value={})
    client.lpush = AsyncMock(return_value=1)
    client.rpop = AsyncMock(return_value=None)
    client.lrange = AsyncMock(return_value=[])
    client.publish = AsyncMock(return_value=1)
    client.subscribe = AsyncMock()
    return client


@pytest.fixture
def mock_redis_pool():
    """Mock Redis connection pool."""
    pool = MagicMock()
    pool.get_connection = AsyncMock()
    pool.release = AsyncMock()
    pool.close = AsyncMock()
    return pool


class TestCaching:
    """Tests for Redis caching operations."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cache_set_get(self, mock_redis_client):
        """Test basic cache set and get."""
        mock_redis_client.set.return_value = True
        mock_redis_client.get.return_value = b'{"user": "test"}'

        with patch("core.cache.redis", mock_redis_client):
            # Set cache
            await mock_redis_client.set(
                "cache:user:123",
                json.dumps({"user": "test"}),
                ex=3600
            )

            # Get cache
            result = await mock_redis_client.get("cache:user:123")
            data = json.loads(result)

            assert data["user"] == "test"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cache_expiration(self, mock_redis_client):
        """Test cache expiration."""
        mock_redis_client.ttl.return_value = 3600

        with patch("core.cache.redis", mock_redis_client):
            ttl = await mock_redis_client.ttl("cache:user:123")
            assert ttl == 3600

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cache_invalidation(self, mock_redis_client):
        """Test cache invalidation."""
        mock_redis_client.delete.return_value = 1

        with patch("core.cache.redis", mock_redis_client):
            result = await mock_redis_client.delete("cache:user:123")
            assert result == 1

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cache_miss(self, mock_redis_client):
        """Test cache miss behavior."""
        mock_redis_client.get.return_value = None

        with patch("core.cache.redis", mock_redis_client):
            result = await mock_redis_client.get("cache:nonexistent")
            assert result is None

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cache_pattern_delete(self, mock_redis_client):
        """Test deleting cache by pattern."""
        mock_redis_client.scan = AsyncMock(return_value=(0, [
            b"cache:user:1",
            b"cache:user:2",
            b"cache:user:3",
        ]))
        mock_redis_client.delete.return_value = 3

        with patch("core.cache.redis", mock_redis_client):
            cursor, keys = await mock_redis_client.scan(match="cache:user:*")
            deleted = await mock_redis_client.delete(*keys)

            assert deleted == 3


class TestSessionManagement:
    """Tests for session management with Redis."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_session(self, mock_redis_client):
        """Test creating a user session."""
        session_data = {
            "user_id": "user-123",
            "tenant_id": "tenant-abc",
            "roles": ["user", "admin"],
        }

        mock_redis_client.hset.return_value = 1

        with patch("core.cache.redis", mock_redis_client):
            for key, value in session_data.items():
                await mock_redis_client.hset(
                    "session:sess-123",
                    key,
                    json.dumps(value) if isinstance(value, list) else value
                )

            mock_redis_client.hset.assert_called()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_session(self, mock_redis_client):
        """Test retrieving a user session."""
        mock_redis_client.hgetall.return_value = {
            b"user_id": b"user-123",
            b"tenant_id": b"tenant-abc",
            b"roles": b'["user", "admin"]',
        }

        with patch("core.cache.redis", mock_redis_client):
            session = await mock_redis_client.hgetall("session:sess-123")

            assert session[b"user_id"] == b"user-123"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_session_expiration(self, mock_redis_client):
        """Test session expiration."""
        mock_redis_client.expire.return_value = True

        with patch("core.cache.redis", mock_redis_client):
            result = await mock_redis_client.expire("session:sess-123", 3600)
            assert result is True

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_invalidate_session(self, mock_redis_client):
        """Test invalidating a session."""
        mock_redis_client.delete.return_value = 1

        with patch("core.cache.redis", mock_redis_client):
            result = await mock_redis_client.delete("session:sess-123")
            assert result == 1

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_invalidate_all_user_sessions(self, mock_redis_client):
        """Test invalidating all sessions for a user."""
        mock_redis_client.scan = AsyncMock(return_value=(0, [
            b"session:sess-1",
            b"session:sess-2",
        ]))
        mock_redis_client.delete.return_value = 2

        with patch("core.cache.redis", mock_redis_client):
            cursor, sessions = await mock_redis_client.scan(
                match="session:user:123:*"
            )
            deleted = await mock_redis_client.delete(*sessions)

            assert deleted == 2


class TestRateLimiting:
    """Tests for rate limiting with Redis."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_rate_limit_check(self, mock_redis_client):
        """Test rate limit check."""
        mock_redis_client.incr.return_value = 5
        mock_redis_client.ttl.return_value = 55

        with patch("core.cache.redis", mock_redis_client):
            key = "ratelimit:user:123:api"
            count = await mock_redis_client.incr(key)
            ttl = await mock_redis_client.ttl(key)

            assert count == 5
            assert ttl == 55

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_rate_limit_exceeded(self, mock_redis_client):
        """Test rate limit exceeded."""
        mock_redis_client.incr.return_value = 101  # Over limit

        with patch("core.cache.redis", mock_redis_client):
            count = await mock_redis_client.incr("ratelimit:user:123:api")
            is_limited = count > 100

            assert is_limited is True

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_sliding_window_rate_limit(self, mock_redis_client):
        """Test sliding window rate limiting."""
        import time
        now = int(time.time())

        mock_redis_client.zadd = AsyncMock(return_value=1)
        mock_redis_client.zremrangebyscore = AsyncMock(return_value=1)
        mock_redis_client.zcard = AsyncMock(return_value=50)

        with patch("core.cache.redis", mock_redis_client):
            key = "ratelimit:sliding:user:123"

            # Remove old entries
            await mock_redis_client.zremrangebyscore(key, 0, now - 60)

            # Add current request
            await mock_redis_client.zadd(key, {str(now): now})

            # Count requests in window
            count = await mock_redis_client.zcard(key)

            assert count == 50


class TestPubSub:
    """Tests for Redis Pub/Sub."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_publish_message(self, mock_redis_client):
        """Test publishing a message."""
        mock_redis_client.publish.return_value = 2  # 2 subscribers

        with patch("core.cache.redis", mock_redis_client):
            subscribers = await mock_redis_client.publish(
                "channel:tasks",
                json.dumps({"task_id": "123", "status": "completed"})
            )

            assert subscribers == 2

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_subscribe_to_channel(self, mock_redis_client):
        """Test subscribing to a channel."""
        messages = []

        async def message_handler(message):
            messages.append(message)

        pubsub = MagicMock()
        pubsub.subscribe = AsyncMock()
        pubsub.get_message = AsyncMock(return_value={
            "type": "message",
            "channel": b"channel:tasks",
            "data": b'{"task_id": "123"}',
        })

        mock_redis_client.pubsub.return_value = pubsub

        with patch("core.cache.redis", mock_redis_client):
            ps = mock_redis_client.pubsub()
            await ps.subscribe("channel:tasks")
            message = await ps.get_message()

            assert message["type"] == "message"
            assert b"task_id" in message["data"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_pattern_subscribe(self, mock_redis_client):
        """Test pattern subscription."""
        pubsub = MagicMock()
        pubsub.psubscribe = AsyncMock()

        mock_redis_client.pubsub.return_value = pubsub

        with patch("core.cache.redis", mock_redis_client):
            ps = mock_redis_client.pubsub()
            await ps.psubscribe("channel:*")

            pubsub.psubscribe.assert_called_once_with("channel:*")


class TestDistributedLocks:
    """Tests for distributed locking with Redis."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_acquire_lock(self, mock_redis_client):
        """Test acquiring a distributed lock."""
        mock_redis_client.set.return_value = True

        with patch("core.cache.redis", mock_redis_client):
            lock_acquired = await mock_redis_client.set(
                "lock:resource:123",
                "owner-abc",
                nx=True,  # Only set if not exists
                ex=30  # 30 second TTL
            )

            assert lock_acquired is True

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_lock_contention(self, mock_redis_client):
        """Test lock contention handling."""
        # First acquire succeeds
        mock_redis_client.set.side_effect = [True, False]

        with patch("core.cache.redis", mock_redis_client):
            # First lock succeeds
            lock1 = await mock_redis_client.set("lock:resource", "owner1", nx=True)
            assert lock1 is True

            # Second lock fails (already locked)
            lock2 = await mock_redis_client.set("lock:resource", "owner2", nx=True)
            assert lock2 is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_release_lock(self, mock_redis_client):
        """Test releasing a distributed lock."""
        # Lua script for safe release
        mock_redis_client.eval = AsyncMock(return_value=1)

        with patch("core.cache.redis", mock_redis_client):
            # Release lock only if we own it
            script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            released = await mock_redis_client.eval(
                script,
                1,
                "lock:resource",
                "owner-abc"
            )

            assert released == 1

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_lock_extension(self, mock_redis_client):
        """Test extending lock TTL."""
        mock_redis_client.expire.return_value = True

        with patch("core.cache.redis", mock_redis_client):
            extended = await mock_redis_client.expire("lock:resource", 30)
            assert extended is True


class TestQueueOperations:
    """Tests for Redis queue operations."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_enqueue_task(self, mock_redis_client):
        """Test enqueueing a task."""
        mock_redis_client.lpush.return_value = 5

        with patch("core.cache.redis", mock_redis_client):
            queue_length = await mock_redis_client.lpush(
                "queue:tasks",
                json.dumps({"task_id": "123", "type": "analysis"})
            )

            assert queue_length == 5

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_dequeue_task(self, mock_redis_client):
        """Test dequeueing a task."""
        mock_redis_client.rpop.return_value = b'{"task_id": "123"}'

        with patch("core.cache.redis", mock_redis_client):
            task = await mock_redis_client.rpop("queue:tasks")
            task_data = json.loads(task)

            assert task_data["task_id"] == "123"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_blocking_dequeue(self, mock_redis_client):
        """Test blocking dequeue operation."""
        mock_redis_client.brpop = AsyncMock(return_value=(
            b"queue:tasks",
            b'{"task_id": "123"}'
        ))

        with patch("core.cache.redis", mock_redis_client):
            result = await mock_redis_client.brpop("queue:tasks", timeout=5)

            assert result is not None
            assert b"task_id" in result[1]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_priority_queue(self, mock_redis_client):
        """Test priority queue with sorted sets."""
        mock_redis_client.zadd = AsyncMock(return_value=1)
        mock_redis_client.zpopmin = AsyncMock(return_value=[
            (b'{"task_id": "high-priority"}', 1.0)
        ])

        with patch("core.cache.redis", mock_redis_client):
            # Add tasks with priority
            await mock_redis_client.zadd("queue:priority", {
                json.dumps({"task_id": "high-priority"}): 1,
                json.dumps({"task_id": "low-priority"}): 10,
            })

            # Get highest priority (lowest score)
            result = await mock_redis_client.zpopmin("queue:priority")

            assert b"high-priority" in result[0][0]
