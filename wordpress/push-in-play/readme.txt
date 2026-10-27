=== Push In Play ===
Contributors: julioreisdev
Tags: push notifications, web push, notifications, leads, broadcast
Requires at least: 5.8
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.10.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Push notifications for your WordPress site: copies, broadcasts and permission popup layout, in a panel of its own.

== Description ==

Push In Play adds a "Push In Play" menu to the WordPress admin:

* **Popup Layout** — several permission prompts (modal, bars, corners) enabled at once as an A/B test, with impressions, clicks and activations per layout and per platform; home-screen invitation for iPhone.
* **Automation** — the sequence every new subscriber receives (right after opting in, 30 min later, next day…), with clicks per step and a test on the team's device.
* **Basic settings** — default sound and vibration, "Send now" to every subscriber, and the sending health card.
* **Copys** — the library of ready notifications (title, text, emoji or image, big image, link), one by one or imported from a spreadsheet (.xlsx/.csv, template included), with filters (available/used), bulk actions, "send now", device test and per-copy metrics.
* **Broadcasts** — daily times (12:00, 12:30…) and weekdays at which the site picks a random copy and sends it to everyone, with what to do with the copy afterwards (delete / mark as used / keep), "fire now", today's status per time, and a history with metrics per send and per copy.

Sending is done in plain PHP (VAPID + RFC 8291) straight from your server: subscribers never leave your site. Built for scale: batches are claimed atomically, pushes go out in parallel (curl_multi), a background worker keeps going until the queue is empty (WP-Cron is only the fallback), metrics live in daily aggregates and old rows are pruned daily.

== Installation ==

1. Upload the plugin and activate it.
2. Open "Push In Play" in the admin sidebar.

== Changelog ==

= 0.10.3 =
* Pub Mail edition: when the plugin is deactivated or deleted, the site leaves "Sites using the plugin" and the metrics panel in Pub Mail right away (it comes back on reactivation).

= 0.10.2 =
* Sync hardening: subscribers counted with one index-covered query, summary only re-sent when a blast actually finishes, install push deferred on visitor requests, no retries after the key was revoked, 10 s timeout.

= 0.10.1 =
* Filter `pip_copies_pick_sql` narrows the pool a broadcast can draw a copy from (tests use it so real copies are never touched; hook for future segmentation).

= 0.10.0 =
* Pub Mail edition: the site sends a metrics summary (subscribers, permission popup, sends and clicks per day, last blasts, top copies, queue health) to the Pub Mail panel every 15 minutes and right after a blast finishes; the panel can also request it on demand (POST /pip/v1/sync with a key-derived token). Only numbers and titles leave the site.

= 0.9.2 =
* Spacing between blocks on the Copys, Broadcasts and History screens.

= 0.9.1 =
* Visual polish of the admin (icons on actions, empty states with actions, custom spreadsheet picker, status stripe on copies, day timeline per broadcast) and a clear explanation of the "send late until" limit.

= 0.9.0 =
* Copys screen (library, spreadsheet import with template, filters, bulk actions, send now, device test, per-copy metrics) and Broadcasts screen (daily times, weekdays, random copy, after-send mode, fire now, today's status, history and per-copy performance).

= 0.8.0 =
* Scale: parallel sending (curl_multi, 25 at a time), batch claiming, background worker chain (no more waiting for the next cron minute), VAPID JWT cached per push service, retry policy with Retry-After, daily aggregates for metrics, daily pruning (sends 90 days, queue 7/30 days, expired subscribers 60 days, log 7 days), service worker cached for a day, diagnostics off by default (toggle for 24 h), endpoint validation and per-IP limits on the public routes, "Sending health" card.

= 0.7.0 =
* Pub Mail edition: license bound to the account (hourly signed check; the popup and all sends pause when the access expires), automatic updates served by Pub Mail, license card in the admin.

= 0.6.2 =
* Single-flight subscription (concurrent calls no longer create two subscriptions); queue rows are claimed atomically (no global lock).

= 0.6.1 =
* When the browser denies the permission request, the popup explains where to allow it (per browser) instead of closing silently; texts editable.

= 0.6.0 =
* Subscription changes are applied in place (same subscriber, no duplicate, no repeated flow); the service worker never races the page; diagnostics log (browser + service worker) on the Automation screen.

= 0.5.3 =
* Fixes orphan subscriptions: the page never drops an existing subscription on its own and the service worker reuses the page's subscription instead of racing to create another.

= 0.5.2 =
* A subscription the push service already rejected (410) is replaced by a fresh one on the next visit.

= 0.5.1 =
* Subscriptions are re-sent once a day while permission is granted (re-activates expired devices) and renewed on pushsubscriptionchange.

= 0.5.0 =
* Basic settings screen: default sound (system / silent / custom sound when the site is open), vibration patterns (Android), keep on screen, renotify; "Send now" to every subscriber with progress and history.

= 0.4.0 =
* Sending: Web Push with VAPID (ES256) and RFC 8291 encryption in plain PHP. Automation screen: activation flow (steps with delay, title, text, icon as site icon / emoji / image, big image, link), queue processed every minute and on visits, click tracking per step, and a "test on this device" card for the team.

= 0.3.6 =
* Separate switches for the iPhone/iPad invitation and the Android/desktop install prompt.

= 0.3.5 =
* Every text in the popup is editable (no built-in fallbacks); blank title/message/steps/tip are simply omitted; share-sheet illustration rows and tip are fields.

= 0.3.4 =
* Push subscription waits for the service worker to activate and retries (fixes activations not being recorded on Chrome); corner popups keep their top/bottom position on phones; true-scale preview.

= 0.3.3 =
* iPhone: links opened inside another app's browser (Google app, Instagram, Facebook, TikTok…) get an "Open in Safari" button (x-safari-https) instead of the share sheet.

= 0.3.2 =
* iPhone invitation: illustration of the iOS share sheet with the "Add to Home Screen" item highlighted (editable label, can be turned off).

= 0.3.1 =
* iPhone invitation: the 3 steps are editable texts (`{share}` = share icon), it counts impressions/clicks/dismissals, and comes back on the next page (or after N minutes) when the visitor tapped but did not add the site.

= 0.3.0 =
* App on the home screen: web app manifest (site name and icon), iPhone/iPad invitation that opens the native share sheet (required for push on iOS), install prompt on Android/desktop after enabling notifications, "apps installed" metric; default trigger delay is now 0 s.

= 0.2.1 =
* Popup Layout: metrics filtered by platform (Android, iPhone/iPad, Windows, Mac, Linux), realistic live preview (browser window / phone), mobile rules applied inside the preview; Leads screen removed for now.

= 0.2.0 =
* Popup Layout: several layouts (modal, bars, corners), texts, colors, trigger, traffic weight, custom CSS, live preview; permission prompt, service worker and push subscription on the site; impressions/clicks/activations per layout.

= 0.1.0 =
* First release: admin menu with the Copys, Broadcasts, Popup Layout and Leads screens.
