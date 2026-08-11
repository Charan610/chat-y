import logging
from typing import List, Tuple, Optional, Dict, Any

from app.config import settings

logger = logging.getLogger(__name__)


class MemoryService:
    def __init__(self):
        self._client = None
        self._collection = None
        self._available = False
        self._init_chroma()

    def _init_chroma(self):
        try:
            import chromadb
            self._client = chromadb.PersistentClient(path=settings.CHROMA_PATH)
            self._collection = self._client.get_or_create_collection(
                name="chat_y_memories",
                metadata={"hnsw:space": "cosine"}
            )
            self._available = True
            logger.info("ChromaDB initialized successfully")
        except Exception as e:
            logger.warning(f"ChromaDB not available: {e}. Memory search will fall back to DB.")
            self._available = False

    async def add_memory(self, memory_id: str, content: str, metadata: Dict[str, Any]):
        """Add a memory to the vector store."""
        if not self._available or self._collection is None:
            return
        try:
            self._collection.add(
                ids=[memory_id],
                documents=[content],
                metadatas=[metadata],
            )
        except Exception as e:
            logger.warning(f"Failed to add memory to ChromaDB: {e}")

    async def search_memories(
        self, query: str, n_results: int = 5
    ) -> List[Tuple[str, Dict, float]]:
        """
        Semantic search for memories.
        Returns list of (content, metadata, distance) tuples.
        """
        if not self._available or self._collection is None:
            return []
        try:
            count = self._collection.count()
            if count == 0:
                return []
            results = self._collection.query(
                query_texts=[query],
                n_results=min(n_results, count),
            )
            output = []
            if results and results.get("documents"):
                docs = results["documents"][0]
                metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
                distances = results["distances"][0] if results.get("distances") else [0.0] * len(docs)
                for doc, meta, dist in zip(docs, metadatas, distances):
                    output.append((doc, meta, dist))
            return output
        except Exception as e:
            logger.warning(f"ChromaDB search error: {e}")
            return []

    async def delete_memory(self, memory_id: str):
        """Delete a memory from the vector store."""
        if not self._available or self._collection is None:
            return
        try:
            self._collection.delete(ids=[memory_id])
        except Exception as e:
            logger.warning(f"Failed to delete memory from ChromaDB: {e}")

    @property
    def is_available(self) -> bool:
        return self._available
