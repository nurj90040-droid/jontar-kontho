জনতার কণ্ঠ — Cloudflare সংস্করণ
================================
এই ZIP-এ আগের সাইটের নকশা রেখে Cloudflare Pages Functions + D1 + R2-এ চালানোর জন্য কোড সাজানো হয়েছে। এটি এখনও আপনার অ্যাকাউন্টে deploy করা হয়নি; নিচের সেটআপ শেষ না করলে অভিযোগ জমা কাজ করবে না।

গুরুত্বপূর্ণ নিরাপত্তা
--------------------
১) অভিযোগ প্রথমে pending থাকবে; সাধারণ দর্শক শুধু admin দ্বারা verified করা অভিযোগ দেখবে।
২) প্রমাণের ছবি/ভিডিও R2-তে private থাকবে; অ্যাডমিন লগইন ছাড়া দেখা যাবে না।
৩) ADMIN_PASSWORD এবং SESSION_SECRET কখনো HTML/JS ফাইলে লিখবেন না। Cloudflare-এর Secrets/Variables-এ দেবেন।
৪) কর্তৃপক্ষকে ইমেইল স্বয়ংক্রিয়ভাবে পাঠানো হয় না; “sent” শুধু অ্যাডমিনের হাতে স্ট্যাটাস।
৫) এখন সর্বোচ্চ ৫টি ফাইল, প্রতিটি ১০ MB পর্যন্ত। এটি প্রাথমিক সংস্করণ; প্রকাশ্যে চালুর আগে abuse/rate-limit নিয়ম যোগ করা ভালো।

প্রয়োজনীয় ফাইল
--------------
public/       = ওয়েবসাইটের HTML/CSS/JS
functions/    = Cloudflare API (অভিযোগ, moderation, evidence)
migrations/   = D1 ডেটাবেস তৈরির SQL
wrangler.toml = Pages project config

সেটআপের সহজ পথ (কম্পিউটারে ফাইল আনজিপ করতে হবে)
------------------------------------------------
ধাপ ১: ZIP আনজিপ করুন। পুরো ফোল্ডার GitHub-এ একটি নতুন repository-তে আপলোড করুন। public, functions, migrations এবং wrangler.toml যেন repository-র মূল স্তরে থাকে।

ধাপ ২: Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git বেছে GitHub repository সংযুক্ত করুন।
Build command ফাঁকা/None রাখুন। Build output directory: public
Deploy করুন। প্রথম deploy-এ API bindings না থাকায় API কাজ নাও করতে পারে—পরের ধাপ শেষ করুন।

ধাপ ৩: Cloudflare Dashboard → Storage & databases → D1 → Create database। নাম দিন jontar-kontho-db। ডেটাবেসের SQL Console খুলে migrations/0001_init.sql ফাইলের সম্পূর্ণ লেখা paste করে Run করুন।

ধাপ ৪: Cloudflare Dashboard → R2 Object Storage → Create bucket। নাম দিন jontar-kontho-evidence। Bucket public করবেন না।

ধাপ ৫: Workers & Pages → আপনার Pages project → Settings → Functions/Bindings (বা Bindings) খুলুন।
- D1 database binding: Variable name = DB; database = jontar-kontho-db
- R2 bucket binding: Variable name = EVIDENCE; bucket = jontar-kontho-evidence
Save করে নতুন deploy দিন।

ধাপ ৬: একই Pages project → Settings → Variables and Secrets-এ production-এর জন্য দুইটি Secret যোগ করুন:
- ADMIN_PASSWORD = আপনার নিজের শক্তিশালী, অনন্য অ্যাডমিন পাসওয়ার্ড
- SESSION_SECRET = অন্তত ৩২ অক্ষরের এলোমেলো গোপন স্ট্রিং
এই দুইটি মান কাউকে দেবেন না এবং কোডে রাখবেন না। Secret যোগ/পরিবর্তনের পর redeploy করুন।

ধাপ ৭: https://আপনার-project.pages.dev/admin.html খুলে অ্যাডমিন পাসওয়ার্ড দিয়ে login করুন। একটি পরীক্ষামূলক অভিযোগ জমা দিয়ে যাচাই করুন। পরীক্ষা শেষ না হওয়া পর্যন্ত প্রকৃত ব্যক্তিগত তথ্য বা সংবেদনশীল প্রমাণ আপলোড করবেন না।

নিজস্ব ঠিকানা protectbd.000.bd
-----------------------------
সাইট প্রথমে pages.dev ঠিকানায় সচল করুন। এরপর Pages → Custom domains → Set up a custom domain-এ protectbd.000.bd যোগ করুন। Netlify/Cloudflare-এর দেওয়া সঠিক DNS নির্দেশনা অনুসরণ করুন। 000.bd-এর DNS কন্ট্রোল প্যানেলে CNAME রেকর্ড যোগ করার অনুমতি না থাকলে 000.bd-এর হোস্টিং সহায়তার প্রয়োজন হতে পারে। parent domain 000.bd আপনার মালিকানায় না থাকলে সেটিকে Cloudflare-এ নিজের zone হিসেবে যোগ করবেন না।

সীমাবদ্ধতা ও দায়িত্বশীল ব্যবহার
------------------------------
- এই ZIP-এ স্বয়ংক্রিয় ইমেইল/কর্তৃপক্ষকে পাঠানো নেই। যাচাই ও আইনি/গোপনীয়তা নীতি স্থির হওয়ার আগে এটি যোগ করা উচিত নয়।
- সাধারণ দর্শক কেবল verified অভিযোগ দেখেন; pending/rejected অভিযোগ private থাকে।
- এই প্রাথমিক সংস্করণে advanced rate limiting, spam protection, malware scanning বা আপলোড করা ভিডিওর transcoding নেই। Public launch-এর আগে Cloudflare WAF/rate limiting সেট করুন এবং privacy/terms প্রকাশ করুন।
- এটি একটি প্রাথমিক migration build; আপনার Cloudflare account-এ deploy/test না করা পর্যন্ত live-ready বলে ধরে নেবেন না।
