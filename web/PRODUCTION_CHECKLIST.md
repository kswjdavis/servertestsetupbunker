# Production Deployment Checklist

## Status: Development Mode ⚠️
**Last Updated:** October 25, 2025
**Current Mode:** Mock Data Enabled

---

## 🔄 Data Source Configuration

### Mock Data Status
| Component | Mock Data | Real API | Notes |
|-----------|-----------|----------|-------|
| Bunker List | ✅ Enabled | ❌ | Using `mockBunkers` from mockData.ts |
| Bunker Status | ✅ Enabled | ❌ | Using `mockBunkerStatus` fallback |
| Device Status | ✅ Enabled | ❌ | Using `mockDevices` array |
| Weather Data | ✅ Enabled | ❌ | Using `mockWeatherData` and `mockWeatherStations` |
| User Authentication | ✅ Enabled | ❌ | Using mock JWT token |
| Emergency Controls | ✅ Enabled | ❌ | Mock success responses |

### API Endpoints Ready for Production
- [ ] `GET /api/v1/bunkers` - List all bunkers
- [ ] `GET /api/v1/bunkers/:id` - Get bunker details
- [ ] `GET /api/v1/bunkers/:id/status` - Get bunker with device status
- [ ] `GET /api/v1/devices` - List all devices
- [ ] `GET /api/v1/weather/current` - Get current weather
- [ ] `POST /api/v1/auth/login` - User authentication
- [ ] `POST /api/v1/control/emergency/global` - Global emergency
- [ ] `POST /api/v1/control/emergency/bunker/:id` - Bunker emergency
- [ ] `POST /api/v1/devices/provision` - Device provisioning

---

## 📋 Pre-Production Tasks

### Backend Requirements
- [ ] FastAPI server deployed and accessible
- [ ] PostgreSQL database with production data
- [ ] All API endpoints tested and returning correct data
- [ ] CORS configured for production domain
- [ ] SSL certificates installed
- [ ] Environment variables configured (.env)

### ESP32 Device Requirements
- [ ] Devices provisioned with auth tokens
- [ ] Devices connected to WiFi network
- [ ] Devices reporting status to backend
- [ ] Relay control tested
- [ ] Status reporting interval confirmed (60 seconds)

### Weather API Integration
- [ ] Weather API credentials obtained
- [ ] API endpoints configured in backend
- [ ] Polling interval configured
- [ ] Unit conversions verified (mph, °F)

---

## 🚀 Production Activation Steps

### 1. Remove Mock Data Fallbacks
**Files to Update:**

#### `/web/src/pages/MapDashboard.tsx`
- [ ] Remove mock data fallback in `fetchBunkers()`
- [ ] Remove mock weather data fallback
- [ ] Line numbers: ~45-55, ~65-75

#### `/web/src/pages/BunkerDetailPage.tsx`
- [ ] Remove mock data fallback in `fetchBunkerStatus()`
- [ ] Line numbers: ~29-37

#### `/web/src/pages/DeviceListPage.tsx`
- [ ] Remove mock device fallback
- [ ] Line numbers: Check fetchDevices function

#### `/web/src/services/*.service.ts`
- [ ] Remove all mock data imports
- [ ] Remove fallback logic in catch blocks

### 2. Update API Configuration
#### `/web/src/services/api.ts`
- [ ] Update `baseURL` to production backend URL
- [ ] Current: `http://localhost:8000`
- [ ] Production: `https://api.yourdomain.com`

### 3. Authentication
#### `/web/src/context/AuthContext.tsx`
- [ ] Remove mock login logic
- [ ] Ensure real API authentication

### 4. Environment Variables
#### `/web/.env.production`
```env
VITE_API_URL=https://api.yourdomain.com
VITE_WEBSOCKET_URL=wss://api.yourdomain.com/ws
VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

---

## ✅ Testing Checklist

### Functional Tests
- [ ] Login with real credentials
- [ ] View all bunkers on map
- [ ] Click bunker → see fan grid
- [ ] Fan status updates every 2 seconds
- [ ] Emergency toggle works
- [ ] Device provisioning flow
- [ ] Weather data displays correctly
- [ ] Units display in US format (mph, °F)

### Performance Tests
- [ ] Page load time < 3 seconds
- [ ] Polling doesn't cause memory leaks
- [ ] Map renders smoothly with all markers
- [ ] Fan grid handles 20+ devices

### Mobile Tests
- [ ] iPhone Safari compatibility
- [ ] Android Chrome compatibility
- [ ] Responsive layout works
- [ ] Touch interactions work

---

## 🔍 Monitoring

### Key Metrics to Track
- [ ] API response times
- [ ] Polling success rate
- [ ] Device online/offline status
- [ ] WebSocket connection stability
- [ ] Error rates in browser console

### Log Locations
- Frontend errors: Browser console
- API errors: `/var/log/bunkercolab-api.log`
- Nginx errors: `/var/log/nginx/error.log`
- Device logs: Backend database `device_status` table

---

## 🚨 Rollback Plan

If issues occur after switching to production:

1. **Quick Revert to Mock Data:**
   ```bash
   git checkout develop  # or last known good branch
   npm run build
   # Deploy build
   ```

2. **Partial Mock Fallback:**
   - Keep mock data fallbacks in catch blocks
   - Allows graceful degradation if API fails

3. **Feature Flags (Future Enhancement):**
   ```javascript
   const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';
   ```

---

## 📝 Notes

### Current Mock Data Locations
- `/web/src/services/mockData.ts` - All mock data definitions
- Individual service files have fallback logic

### Polling Intervals
- Frontend → Backend: 2 seconds (bunker status)
- ESP32 → Backend: 60 seconds (device status)
- Weather API → Backend: 5 minutes (configurable)

### Known Limitations with Mock Data
- Emergency controls show success but don't affect fan state
- Weather data is static (doesn't change)
- Device provisioning creates fake tokens
- User settings aren't persisted

---

## 🎯 Production Readiness Score

**Current: 3/10** (Development Mode with Mock Data)

**Target: 10/10** Requirements:
- [ ] All API endpoints connected
- [ ] Real device data flowing
- [ ] Weather API integrated
- [ ] Authentication working
- [ ] SSL/HTTPS configured
- [ ] Error handling tested
- [ ] Monitoring in place
- [ ] Backup/restore tested
- [ ] Documentation complete
- [ ] Team trained on operations

---

**Last Review Date:** _________________
**Reviewed By:** _________________
**Next Review:** _________________