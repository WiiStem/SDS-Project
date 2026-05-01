# Lab SDS Library

Lab SDS Library is a MySQL + Prisma web app for browsing, printing, and administrating Safety Data Sheet PDFs by lab. Public users can search/filter and open PDFs. Admins sign in with Microsoft and can add, edit, replace, and delete records.

## Stack

- Node.js + Express
- EJS server-rendered views
- MySQL
- Prisma ORM
- Microsoft OAuth via `passport-microsoft`
- S3-compatible object storage for Railway bucket usage

## Features included

- Public SDS listing with keyword search, lab/tag filters, sorting, and URL query params
- QR-code friendly filtered URLs such as `/sds?lab=chem-lab`
- Single-document page with embedded scrollable PDF and print support
- Multi-select "Print Selected" flow
- Admin list and add/edit/delete workflow
- PDF uploads to a Railway-style S3 bucket
- Automatic reusable tag creation on save
- Many-to-many lab and tag relationships via Prisma

## Project structure

- `src/app.js`: Express app bootstrap
- `src/routes/public.js`: public browse, detail, file, and print routes
- `src/routes/admin.js`: admin CRUD routes
- `src/routes/auth.js`: Microsoft login/logout
- `src/services/documentService.js`: Prisma-backed query and mutation logic
- `src/services/storage.js`: bucket upload/delete/download URL helpers
- `prisma/schema.prisma`: MySQL schema
- `views/`: EJS templates

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env template:

   ```bash
   copy .env.example .env
   ```

3. Set up MySQL and update `DATABASE_URL` in `.env`.

4. Fill in Microsoft app registration values:

   - `MICROSOFT_CLIENT_ID`
   - `MICROSOFT_CLIENT_SECRET`
   - `MICROSOFT_TENANT_ID`
   - `APP_URL`
   - `ADMIN_EMAILS`

5. Fill in Railway bucket or other S3-compatible storage values:

   - `S3_ENDPOINT`
   - `S3_BUCKET`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_PUBLIC_BASE_URL` if files should be served publicly

6. Generate Prisma client and migrate:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

7. Start the app:

   ```bash
   npm run dev
   ```

For a local production-style start without running migrations first:

```bash
npm run start:local
```

## Railway deployment

Railway should use the normal npm start command:

```bash
npm start
```

That runs `prisma migrate deploy` before starting Express, so the MySQL tables are created from committed migrations before the app calls Prisma. If an existing Railway deployment is already failing with `The table Lab does not exist in the current database`, redeploy after confirming `DATABASE_URL` points to the Railway MySQL database. You can also run the migration once from Railway's shell:

```bash
npm run prisma:deploy
```

## Notes

- The app uses Express session memory storage by default. For production, swap it with a persistent session store.
- The bucket flow is server-uploaded for simplicity, but the storage layer is isolated so you can switch to presigned direct browser uploads later.
- `PUBLIC_NOTES=true` controls whether notes appear on public pages.
- `ADMIN_EMAILS` acts as an allowlist for Microsoft-authenticated admins.
- `LABS` controls which labs are available on the website and in admin forms. Use a comma-separated list such as `ADS, AUR, AUT` or `Chemistry Lab:chem-lab, Biology Lab:bio-lab`.

## Suggested next steps

- Add a dedicated labs admin screen
- Move uploads to presigned direct-to-bucket flow
- Add database-backed sessions
- Add automated tests for route behavior and Prisma queries
