# API Usage Examples

## Base URL
```
http://54.234.25.21:3000
```

## 1. Health Check

### cURL
```bash
curl http://54.234.25.21:3000/api/health
```

### JavaScript (Node.js)
```javascript
const axios = require('axios');

async function checkHealth() {
  try {
    const response = await axios.get('http://54.234.25.21:3000/api/health');
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkHealth();
```

### JavaScript (Fetch API)
```javascript
fetch('http://54.234.25.21:3000/api/health')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

### Python
```python
import requests

response = requests.get('http://54.234.25.21:3000/api/health')
print(response.json())
```

### PHP
```php
<?php
$response = file_get_contents('http://54.234.25.21:3000/api/health');
$data = json_decode($response, true);
print_r($data);
?>
```

## 2. Setup FreePBX Configuration

### cURL
```bash
curl -X POST http://54.234.25.21:3000/api/setup-freepbx \
  -H "Content-Type: application/json" \
  -d '{"did": "+16592448782"}'
```

### JavaScript (Node.js with Axios)
```javascript
const axios = require('axios');

async function setupFreePBX(did) {
  try {
    const response = await axios.post(
      'http://54.234.25.21:3000/api/setup-freepbx',
      { did: did },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    console.log('Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
setupFreePBX('+16592448782')
  .then(result => console.log('Setup completed:', result))
  .catch(err => console.error('Setup failed:', err));
```

### JavaScript (Fetch API)
