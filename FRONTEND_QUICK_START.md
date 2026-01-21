# Frontend Quick Start Guide

## Getting Started

### Base URL
```
http://localhost:3000/api/v1
```

### Interactive API Docs
```
http://localhost:3000/api/docs
```

---

## Quick Integration Examples

### 1. Search Implementation

#### Basic Search (Recommended)
```javascript
// Hybrid search - best for most use cases
const searchCases = async (query, limit = 10) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  const data = await response.json();
  return data;
};

// Usage
const results = await searchCases("tax revenue", 5);
console.log(results.results);
```

#### TypeScript Interface
```typescript
interface SearchResult {
  documentId: string;
  documentName: string;
  caseId: string;
  pageNumber: number;
  content: string;
  score: number;
  matchType: 'full-text' | 'semantic' | 'hybrid';
  caseMetadata: {
    caseNumber: string;
    caseType: string;
    appellant: string;
    respondent: string;
    filingDate: string | null;
    hearingDate: string | null;
    decisionDate: string | null;
    status: string;
    outcome: string | null;
    taxAmountDisputed: number | null;
    chairperson: string | null;
    boardMembers: string[] | null;
  };
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchType: 'full-text' | 'semantic' | 'hybrid';
  executionTimeMs: number;
}
```

---

### 2. React Component Example

```tsx
import React, { useState } from 'react';

interface SearchResult {
  documentId: string;
  documentName: string;
  pageNumber: number;
  content: string;
  score: number;
  caseMetadata: {
    caseNumber: string;
    caseType: string;
    appellant: string;
    respondent: string;
    taxAmountDisputed: number | null;
    chairperson: string | null;
    boardMembers: string[] | null;
  };
}

const CaseSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [executionTime, setExecutionTime] = useState(0);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `http://localhost:3000/api/v1/search?q=${encodeURIComponent(query)}&limit=10`
      );
      const data = await response.json();

      setResults(data.results);
      setExecutionTime(data.executionTimeMs);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cases..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {executionTime > 0 && (
        <p>Found {results.length} results in {executionTime}ms</p>
      )}

      <div>
        {results.map((result) => (
          <div key={`${result.documentId}-${result.pageNumber}`}>
            <h3>{result.caseMetadata.caseNumber}</h3>
            <p><strong>Type:</strong> {result.caseMetadata.caseType}</p>
            <p><strong>Appellant:</strong> {result.caseMetadata.appellant}</p>
            <p><strong>Respondent:</strong> {result.caseMetadata.respondent}</p>
            <p><strong>Tax Amount:</strong> TZS {result.caseMetadata.taxAmountDisputed?.toLocaleString()}</p>
            <p><strong>Chairperson:</strong> {result.caseMetadata.chairperson}</p>
            <p><strong>Board Members:</strong> {result.caseMetadata.boardMembers?.join(', ')}</p>
            <p><strong>Document:</strong> {result.documentName} (Page {result.pageNumber})</p>
            <p><strong>Relevance:</strong> {(result.score * 100).toFixed(1)}%</p>
            <blockquote>{result.content}</blockquote>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CaseSearch;
```

---

### 3. Vue.js Example

```vue
<template>
  <div class="case-search">
    <form @submit.prevent="handleSearch">
      <input
        v-model="query"
        type="text"
        placeholder="Search cases..."
      />
      <button type="submit" :disabled="loading">
        {{ loading ? 'Searching...' : 'Search' }}
      </button>
    </form>

    <div v-if="executionTime > 0" class="stats">
      Found {{ results.length }} results in {{ executionTime }}ms
    </div>

    <div class="results">
      <div
        v-for="result in results"
        :key="`${result.documentId}-${result.pageNumber}`"
        class="result-card"
      >
        <h3>{{ result.caseMetadata.caseNumber }}</h3>
        <p><strong>Appellant:</strong> {{ result.caseMetadata.appellant }}</p>
        <p><strong>Chairperson:</strong> {{ result.caseMetadata.chairperson }}</p>
        <p><strong>Board:</strong> {{ result.caseMetadata.boardMembers?.join(', ') }}</p>
        <p><strong>Page:</strong> {{ result.pageNumber }}</p>
        <blockquote>{{ result.content }}</blockquote>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const query = ref('');
const results = ref([]);
const loading = ref(false);
const executionTime = ref(0);

const handleSearch = async () => {
  loading.value = true;

  try {
    const response = await fetch(
      `http://localhost:3000/api/v1/search?q=${encodeURIComponent(query.value)}&limit=10`
    );
    const data = await response.json();

    results.value = data.results;
    executionTime.value = data.executionTimeMs;
  } catch (error) {
    console.error('Search failed:', error);
  } finally {
    loading.value = false;
  }
};
</script>
```

---

### 4. OCR Status Monitoring

```typescript
// Poll OCR job status
const pollJobStatus = async (jobId: string): Promise<void> => {
  const checkStatus = async () => {
    const response = await fetch(
      `http://localhost:3000/api/v1/ocr/queue/job/${jobId}`
    );
    const job = await response.json();

    if (job.status === 'completed') {
      console.log('OCR completed!', job.result);
      return true;
    } else if (job.status === 'failed') {
      console.error('OCR failed:', job.error);
      return true;
    }

    return false;
  };

  // Poll every 5 seconds
  const interval = setInterval(async () => {
    const done = await checkStatus();
    if (done) {
      clearInterval(interval);
    }
  }, 5000);
};

// Usage
const response = await fetch(
  'http://localhost:3000/api/v1/ocr/process/pending',
  { method: 'POST' }
);
const { jobs } = await response.json();

// Monitor first job
if (jobs.length > 0) {
  await pollJobStatus(jobs[0].id);
}
```

---

### 5. Document Statistics Dashboard

```typescript
const getDocumentStats = async () => {
  const response = await fetch(
    'http://localhost:3000/api/v1/ocr/documents/stats'
  );
  return await response.json();
};

// Usage
const stats = await getDocumentStats();
console.log(`Total: ${stats.total}`);
console.log(`Completed: ${stats.completed}`);
console.log(`Pending: ${stats.pending}`);
console.log(`Failed: ${stats.failed}`);
```

---

## Advanced Search Options

### 1. Full-Text Search Only
```javascript
const fullTextSearch = async (query) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/search/full-text?q=${encodeURIComponent(query)}&limit=10`
  );
  return await response.json();
};
```

**Best for:**
- Exact keyword matching
- Searching for specific terms
- Legal citations

---

### 2. Semantic Search Only
```javascript
const semanticSearch = async (query) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/search/semantic?q=${encodeURIComponent(query)}&limit=10`
  );
  return await response.json();
};
```

**Best for:**
- Natural language questions
- Conceptual searches
- Finding similar meanings

---

### 3. Custom Weighted Hybrid Search
```javascript
const customSearch = async (query, ftWeight = 0.3, semWeight = 0.7) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/search/hybrid?q=${encodeURIComponent(query)}&ftWeight=${ftWeight}&semWeight=${semWeight}&limit=10`
  );
  return await response.json();
};

// More semantic (good for questions)
await customSearch("what is the limitation period?", 0.3, 0.7);

// More keyword-based (good for exact terms)
await customSearch("Section 16(3)", 0.7, 0.3);
```

---

## Error Handling

```typescript
const searchWithErrorHandling = async (query: string) => {
  try {
    const response = await fetch(
      `http://localhost:3000/api/v1/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      console.error('Network error:', error);
      // Handle network errors (offline, CORS, etc.)
    } else {
      console.error('Search error:', error);
      // Handle other errors
    }
    throw error;
  }
};
```

---

## Useful Utilities

### Format Tax Amount
```typescript
const formatTaxAmount = (amount: number | null): string => {
  if (!amount) return 'N/A';
  return `TZS ${amount.toLocaleString('en-US')}`;
};
```

### Format Date
```typescript
const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-GB');
};
```

### Highlight Search Terms
```typescript
const highlightText = (text: string, query: string): string => {
  const terms = query.toLowerCase().split(/\s+/);
  let highlighted = text;

  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });

  return highlighted;
};
```

---

## Testing Endpoints

### Quick Curl Commands

```bash
# Basic search
curl "http://localhost:3000/api/v1/search?q=tax%20revenue&limit=5"

# Full-text search
curl "http://localhost:3000/api/v1/search/full-text?q=appellant&limit=3"

# Semantic search
curl "http://localhost:3000/api/v1/search/semantic?q=limitation%20period&limit=5"

# Get document stats
curl "http://localhost:3000/api/v1/ocr/documents/stats"

# Get queue stats
curl "http://localhost:3000/api/v1/ocr/queue/stats"

# Process pending documents
curl -X POST "http://localhost:3000/api/v1/ocr/process/pending"
```

---

## Performance Tips

1. **Use Hybrid Search by Default** - Best balance of accuracy and speed
2. **Implement Debouncing** - Wait 300-500ms after user stops typing before searching
3. **Cache Results** - Cache search results for common queries
4. **Pagination** - Use `limit` parameter to control result count
5. **Loading States** - Always show loading indicators (search takes 25-120ms)

---

## Common Use Cases

### 1. Case Number Lookup
```javascript
// Use full-text search for exact case numbers
const caseNumber = "DSM.211/2024";
const results = await fetch(
  `http://localhost:3000/api/v1/search/full-text?q=${encodeURIComponent(caseNumber)}`
);
```

### 2. Legal Research
```javascript
// Use semantic search for concepts
const question = "what happens when appeal is filed late?";
const results = await fetch(
  `http://localhost:3000/api/v1/search/semantic?q=${encodeURIComponent(question)}`
);
```

### 3. Find Cases by Appellant
```javascript
// Use hybrid search for names
const appellant = "INTERGRITY SECURITY COMPANY LIMITED";
const results = await fetch(
  `http://localhost:3000/api/v1/search?q=${encodeURIComponent(appellant)}`
);
```

---

## Next Steps

1. ✅ Implement basic search UI
2. ✅ Add OCR status monitoring
3. 🔄 Wait for User Management API (coming next)
4. 📋 Implement authentication
5. 📋 Add advanced filters (date range, case type, outcome)
6. 📋 Add export functionality

---

## Support

For API issues or questions:
- Check `API_DOCUMENTATION.md` for detailed endpoint information
- Visit Swagger docs at `http://localhost:3000/api/docs`

---

**Happy Coding! 🚀**
