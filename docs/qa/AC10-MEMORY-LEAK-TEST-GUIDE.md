# AC10: Memory Leak Testing Guide

**Story:** 5.7 - Performance Optimization
**Test Duration:** ~30 minutes
**Browser Required:** Google Chrome
**Tester:** You (Jeff)

---

## Prerequisites

✅ Production server running: http://206.189.210.203
✅ Chrome browser installed
✅ Test credentials:
- **Username:** `loadtestadmin`
- **Password:** `LoadTest123`

---

## Step-by-Step Instructions

### Step 1: Open Chrome and Navigate to Site (2 minutes)

1. Open **Google Chrome** (not Safari, Firefox, etc.)
2. Navigate to: **http://206.189.210.203**
3. Login with credentials above
4. You should see the Dashboard

### Step 2: Open Chrome DevTools Memory Profiler (1 minute)

1. Press **F12** (or right-click → Inspect)
2. Click the **Memory** tab at the top
3. You should see three radio options:
   - ○ Heap snapshot
   - ○ Allocation instrumentation on timeline
   - ○ Allocation sampling

4. Select **"Heap snapshot"**

### Step 3: Take Baseline Snapshot (1 minute)

1. Click the **blue circle "Take snapshot"** button
2. Wait ~10 seconds for snapshot to complete
3. You'll see "Snapshot 1" appear in left sidebar
4. Note the total size (should be ~5-15 MB typically)

**Screenshot this if you want evidence!**

### Step 4: Navigate Between Pages (5 minutes)

**Goal:** Stress-test the React app by loading/unloading components repeatedly.

Follow this loop **10 times** (~30 seconds per loop):

1. Click **"Dashboard"** in sidebar
2. Click on any bunker card → **Bunker Detail** page loads
3. Click **"Devices"** in sidebar
4. Click **"Settings"** in sidebar
5. Click **"System Health"** in sidebar (if visible)
6. Click **"Dashboard"** again → repeat

**Tip:** You can go faster if you're comfortable. The goal is to trigger many component mount/unmount cycles.

### Step 5: Take Second Snapshot (1 minute)

1. After completing ~10 navigation loops, stay on Dashboard
2. Click **"Take snapshot"** again (blue circle)
3. Wait for "Snapshot 2" to appear
4. Note the total size

### Step 6: Compare Snapshots (2 minutes)

1. Click **"Snapshot 2"** in the left sidebar
2. In the dropdown at the top (default says "Summary"), select **"Comparison"**
3. In the second dropdown, select **"Snapshot 1"** (to compare against)
4. Look at the **"Size Delta"** column

**What to look for:**
- ✅ **GOOD:** Delta shows small increases (few hundred KB) with many reds and blues canceling out
- ✅ **GOOD:** No single object type growing by 10+ MB
- ❌ **BAD:** Large objects growing monotonically (e.g., "Detached DOM tree" with +5 MB)
- ❌ **BAD:** Event listeners or timers accumulating

### Step 7: Idle Memory Test (10 minutes)

1. Leave the browser tab open on the Dashboard
2. **Do NOT interact with it** for 10 minutes
3. Go get coffee, check your email, whatever - just leave it alone
4. After 10 minutes, take **"Snapshot 3"**

### Step 8: Final Comparison (2 minutes)

1. Click **"Snapshot 3"**
2. Dropdown → **"Comparison"** → **"Snapshot 2"**
3. Check the Size Delta

**What to look for:**
- ✅ **GOOD:** Minimal growth (< 1 MB) - memory is stable when idle
- ✅ **GOOD:** Garbage collector is working (some negative deltas)
- ❌ **BAD:** Continuous growth during idle period (indicates timer/interval leak)

---

## Pass/Fail Criteria

### ✅ PASS if:
- [ ] Size delta between Snapshot 1 and 2 is < 10 MB
- [ ] No "Detached DOM tree" objects growing significantly
- [ ] Snapshot 3 (idle) shows < 1 MB growth from Snapshot 2
- [ ] No obvious runaway objects in comparison view

### ❌ FAIL if:
- [ ] Size delta between Snapshot 1 and 2 is > 20 MB
- [ ] "Detached DOM tree" is accumulating (multiple MB)
- [ ] Idle period (Snapshot 2 → 3) shows > 5 MB growth
- [ ] Event listeners or timers are accumulating indefinitely

---

## Expected Results (for your app)

Based on the React implementation with:
- ✅ Lazy-loaded routes (components unmount cleanly)
- ✅ Functional components with hooks
- ✅ Proper useEffect cleanup patterns

**You should see:**
1. **Snapshot 1 → 2:** ~3-8 MB growth (normal for loading components)
2. **Snapshot 2 → 3:** < 500 KB growth (idle memory should be stable)
3. **No red flags** in comparison view

---

## Troubleshooting

**Q: Snapshot 2 is SMALLER than Snapshot 1?**
A: That's fine! Chrome's garbage collector ran. This is actually good.

**Q: I see "Detached DOM tree" with 2-3 MB - is that bad?**
A: Not necessarily. If it's NOT growing between snapshots, it's fine. React may keep some things around.

**Q: The comparison view is overwhelming - what do I focus on?**
A: Sort by "Size Delta" column. Look at the top 5 rows. If they're all < 1 MB each, you're good.

**Q: Chrome crashed during the test?**
A: That's actually a memory leak! But unlikely with this app. Restart and try again.

---

## Recording Your Results

### Snapshot Results Table

| Snapshot | Total Size | Delta from Previous |
|----------|------------|---------------------|
| Snapshot 1 (baseline) | _______ MB | N/A |
| Snapshot 2 (after navigation) | _______ MB | _______ MB |
| Snapshot 3 (after idle) | _______ MB | _______ MB |

### Final Verdict

- [ ] ✅ **PASS** - No memory leaks detected
- [ ] ❌ **FAIL** - Memory leaks found (describe below)

**Notes:**
_________________________________________
_________________________________________
_________________________________________

---

## What to Do Next

### If PASS:
1. Take a screenshot of the comparison view (Snapshot 1 vs 2)
2. Tell Claude: **"AC10 passed! Here are the results: [paste snapshot sizes]"**
3. I'll update the quality gate to PASS

### If FAIL:
1. Take screenshots of the problematic objects in comparison view
2. Tell Claude: **"AC10 failed - I see memory growth in [specific area]"**
3. We'll debug together and identify the leak source

---

## Time Estimate

- **Minimum:** 15 minutes (if you rush through navigation loops)
- **Recommended:** 30 minutes (thorough testing + idle period)
- **Maximum:** 45 minutes (if you explore the profiler in depth)

---

**Ready to start? Open Chrome and let's go!** 🚀

When you're done, just tell me:
- "Passed with X MB → Y MB → Z MB"
- Or "Failed - seeing growth in [area]"
