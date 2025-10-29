# Weather API Integration Recommendations

## Overview
Based on analysis of the PreservAir project, here are recommendations for implementing weather data integration in Bunkercolab using both Aviation Weather and NWS APIs.

## 1. Aviation Weather API Integration

### Key Features to Implement
- **METAR Data Fetching**: Real-time weather observations from aviation stations
- **Bounding Box Queries**: Fetch weather data for geographic regions around bunkers
- **Station Discovery**: Find nearest weather stations to bunker locations
- **Caching Strategy**: 1-minute cache for METAR data, 5-minute for station info

### Implementation Architecture

```python
# server/app/services/aviation_weather_service.py
class AviationWeatherService:
    def __init__(self):
        self.base_url = "https://aviationweather.gov"
        self.cache_ttl = 60  # seconds
        self.session = httpx.AsyncClient()

    async def get_metars_by_bbox(
        self,
        lat: float,
        lon: float,
        radius_km: float = 50
    ) -> List[MetarObservation]:
        """Fetch METAR observations within radius of location"""
        # Convert radius to bounding box
        # Cache results for 1 minute

    async def get_nearest_stations(
        self,
        lat: float,
        lon: float,
        count: int = 5
    ) -> List[StationInfo]:
        """Find nearest weather stations using haversine distance"""
```

### Data Models

```python
# server/app/models/weather.py
class MetarObservation(BaseModel):
    station_id: str
    observation_time: datetime
    temperature_c: Optional[float]
    dewpoint_c: Optional[float]
    wind_direction: Optional[int]  # degrees
    wind_speed_kt: Optional[float]
    wind_gust_kt: Optional[float]
    visibility_mi: Optional[float]
    altimeter_hpa: Optional[float]
    raw_text: str
    latitude: Optional[float]
    longitude: Optional[float]
```

## 2. NWS Alert Integration

### Key Features to Implement
- **Real-time Alert Monitoring**: Poll for severe weather alerts
- **Location-Based Alerts**: Monitor specific bunker locations
- **Event Filtering**: Focus on wind-related alerts (High Wind, Tornado, Severe Thunderstorm)
- **Alert Deduplication**: Track processed alerts to avoid duplicates

### Implementation Architecture

```python
# server/app/services/nws_alert_service.py
class NWSAlertService:
    def __init__(self):
        self.base_url = "https://api.weather.gov"
        self.poll_interval = 60  # seconds
        self.processed_alerts = set()
        self.user_agent = "Bunkercolab/1.0 (contact@bunkercolab.com)"

    async def start_monitoring(self, bunker_id: int):
        """Start monitoring alerts for a bunker location"""
        # Resolve forecast zone and county
        # Begin polling loop

    async def check_alerts_for_point(
        self,
        lat: float,
        lon: float
    ) -> List[WeatherAlert]:
        """Check for active alerts at specific coordinates"""
```

### Alert Types to Monitor
```python
RELEVANT_ALERT_TYPES = [
    "Tornado Warning",
    "Tornado Watch",
    "Severe Thunderstorm Warning",
    "Severe Thunderstorm Watch",
    "High Wind Advisory",
    "High Wind Warning",
    "Wind Advisory"
]
```

## 3. Wind Decision Engine

### Core Logic
```python
# server/app/services/fan_control_service.py
class FanControlService:
    def __init__(self):
        self.wind_threshold_mph = 15  # Default threshold
        self.shutdown_allowed_duration = 300  # 5 minutes

    async def evaluate_conditions(
        self,
        bunker: Bunker,
        weather_data: MetarObservation
    ) -> FanControlDecision:
        """
        Evaluate if fans can be safely shut down

        Decision factors:
        1. Wind speed >= threshold
        2. Wind direction favorable to bunker orientation
        3. No active severe weather alerts
        4. Stable conditions (not rapidly changing)
        """

        # Calculate relative wind angle to bunker
        relative_angle = calculate_relative_angle(
            weather_data.wind_direction,
            bunker.orientation_degrees
        )

        # Favorable wind: 45-135 degrees relative (crosswind)
        is_favorable = 45 <= relative_angle <= 135

        # Check for alerts
        has_alerts = await self.check_active_alerts(bunker)

        return FanControlDecision(
            shutdown_allowed=is_favorable and not has_alerts,
            reason=self.get_decision_reason(),
            expires_at=datetime.now() + timedelta(seconds=300)
        )
```

## 4. Database Schema Updates

```sql
-- Add weather data caching table
CREATE TABLE weather_observations (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(10) NOT NULL,
    bunker_id INTEGER REFERENCES bunkers(id),
    observation_time TIMESTAMP NOT NULL,
    temperature_c FLOAT,
    wind_direction INTEGER,
    wind_speed_kt FLOAT,
    wind_gust_kt FLOAT,
    raw_metar TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(station_id, observation_time)
);

-- Add weather alerts table
CREATE TABLE weather_alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100),
    severity VARCHAR(50),
    urgency VARCHAR(50),
    certainty VARCHAR(50),
    effective TIMESTAMP,
    expires TIMESTAMP,
    headline TEXT,
    affected_bunkers INTEGER[],
    geometry JSONB,
    processed_at TIMESTAMP DEFAULT NOW()
);

-- Add weather stations reference table
CREATE TABLE weather_stations (
    icao_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    elevation_m FLOAT,
    distance_km FLOAT,  -- Distance from nearest bunker
    active BOOLEAN DEFAULT true
);
```

## 5. API Endpoints

```python
# server/app/api/v1/endpoints/weather.py

@router.get("/weather/current/{bunker_id}")
async def get_current_weather(bunker_id: int):
    """Get current weather conditions for a bunker"""

@router.get("/weather/alerts/{bunker_id}")
async def get_weather_alerts(bunker_id: int):
    """Get active weather alerts for a bunker location"""

@router.post("/weather/stations/discover")
async def discover_nearby_stations(lat: float, lon: float):
    """Discover and save nearby weather stations"""
```

## 6. Background Tasks

```python
# server/app/tasks/weather_tasks.py
from celery import Celery
from datetime import timedelta

celery_app = Celery('bunkercolab')

@celery_app.task
def fetch_weather_data():
    """Fetch weather data for all active bunkers every 2 minutes"""

@celery_app.task
def check_weather_alerts():
    """Check for weather alerts every 60 seconds"""

@celery_app.task
def evaluate_fan_control():
    """Evaluate fan control decisions every 60 seconds"""
```

## 7. Error Handling & Resilience

### Retry Strategy
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
async def fetch_with_retry(url: str, headers: dict):
    """Fetch with exponential backoff retry"""
```

### Fallback Behavior
- If weather data unavailable: Keep fans ON (fail-safe)
- If conflicting data: Use most conservative option
- Log all API failures for monitoring

## 8. Configuration

```python
# server/app/core/config.py
class WeatherSettings(BaseSettings):
    # Aviation Weather API
    aviation_weather_base_url: str = "https://aviationweather.gov"
    aviation_weather_cache_ttl: int = 60

    # NWS API
    nws_api_base_url: str = "https://api.weather.gov"
    nws_user_agent: str = "Bunkercolab/1.0"
    nws_poll_interval: int = 60

    # Control Parameters
    wind_speed_threshold_mph: float = 15.0
    wind_direction_tolerance: int = 45  # degrees
    shutdown_duration_seconds: int = 300

    class Config:
        env_prefix = "WEATHER_"
```

## 9. Testing Strategy

```python
# server/tests/test_weather_services.py

@pytest.mark.asyncio
async def test_metar_parsing():
    """Test METAR observation parsing"""

@pytest.mark.asyncio
async def test_wind_decision_logic():
    """Test fan control decision making"""

@pytest.mark.asyncio
async def test_alert_deduplication():
    """Test that duplicate alerts aren't processed"""

# Mock external API responses
@pytest.fixture
def mock_aviation_weather(mocker):
    return mocker.patch('httpx.AsyncClient.get')
```

## 10. Monitoring & Observability

### Metrics to Track
- API response times and error rates
- Cache hit/miss ratios
- Alert processing latency
- Fan state changes per hour
- Energy savings calculations

### Logging
```python
import structlog

logger = structlog.get_logger()

logger.info(
    "weather_decision",
    bunker_id=bunker.id,
    wind_speed=weather.wind_speed_kt,
    decision="shutdown_allowed",
    reason="favorable_wind_conditions"
)
```

## Implementation Priority

1. **Phase 1**: Basic METAR fetching and parsing
2. **Phase 2**: Wind-based decision logic
3. **Phase 3**: NWS alert integration
4. **Phase 4**: Background task scheduling
5. **Phase 5**: Energy savings tracking

## Security Considerations

- Add rate limiting to prevent API abuse
- Validate all geographic coordinates
- Sanitize station IDs before queries
- Use HTTPS for all external API calls
- Store API responses for audit trail

## Performance Optimizations

- Batch API requests when possible
- Use Redis for caching frequently accessed data
- Implement database indexes on weather_observations(station_id, observation_time)
- Consider GraphQL for efficient data fetching from frontend

---

This implementation plan provides a robust foundation for integrating weather data into the Bunkercolab system while maintaining safety-first operation principles.