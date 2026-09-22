# Kashif Traders local offline billing

Yeh server shop ke laptop par chalta hai. Cash Sale aur Cashier devices same local Wi-Fi par hon to internet ke baghair invoice foran transfer hoti hai. Internet wapas aane par pending bills cloud database mein sync hote hain.

## One-time Windows setup

1. Is project folder ko laptop par rakhein.
2. Laptop ko shop ke Wi-Fi/router se connect karein aur network profile **Private** rakhein.
3. `local-server/setup-windows.cmd` ko **Run as administrator** karein.
4. Setup jo `http://192.168.x.x:8787` address dikhaye, wahi Cash Sale aur Cashier mobile par open/bookmark karein.
5. Internet available ho to har device par aik dafa apne employee code/PIN se login karein.
6. Internet band karke Cash Sale se test bill bhejein; Cashier page par Refresh/Sync se bill foran nazar aani chahiye.

Server Windows login par khud start hota hai. Laptop ka IP router mein reserve/static rakhna behtar hai. Laptop aur router ko UPS/power backup dein.

## Status check

Browser mein `http://LAPTOP-IP:8787/api/local-status` kholne par pending cloud sync count aur errors nazar aate hain.

## Important

- Devices Vercel URL ki bajaye laptop ka local URL use karein.
- Laptop off ho to devices aapas mein invoice transfer nahi kar sakte.
- Local data `local-server/data/local-billing.json` mein rehta hai; is folder ka backup rakhein.
- Production URL default nahi hai. Server working-branch preview ke saath configured hai.

