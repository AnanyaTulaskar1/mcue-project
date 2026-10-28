# MCue Studio Manager

MCue is an admin-only studio workspace. The team records client details from direct conversations, schedules and manages shoots, and tracks payment requests. Clients do not need accounts.

## Run locally

1. Copy `mcue-backend/.env.example` to `mcue-backend/.env` and set the MongoDB URL, a private JWT secret, and the administrator email and password.
2. Add SMTP credentials to the same file. The app still saves shoot and payment records if email delivery is unavailable; failed payment emails can be retried from Payments.
3. In `mcue-backend`, run `npm install` and `npm run dev`.
4. In `mcue-frontend`, run `npm install` and `npm run dev`.
5. Sign in with the configured administrator email and password.

The first backend launch creates the configured admin account if it does not exist. If the address belongs to an old client login, configuring it as `ADMIN_EMAIL` promotes that account to the studio admin. Existing client accounts are copied to the new client-contact collection, and linked shoots are remapped so their history remains available.

## Deploy with Render and Vercel

The repository includes a Render Blueprint at `render.yaml` for the backend. In Render, create a Blueprint from the repository and provide these secret environment values when prompted:

- `MONGO_URI`: your hosted MongoDB connection string.
- `JWT_SECRET`: a long, private random value.
- `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`: the studio admin login to create on first startup.
- `CORS_ORIGINS`: the production Vercel origin, such as `https://your-studio.vercel.app` (no trailing slash).

Render runs the backend over HTTP behind its HTTPS proxy. The app keeps local HTTPS for development and uses Render's `PORT` in production. Optional SMTP settings can be added to Render if you want payment emails and password reset codes delivered by email.

For the frontend, import the repository into Vercel and set the project root to `mcue-frontend`. Use `npm run build` as the build command and `dist` as the output directory. Add this Vercel environment variable, replacing the example with your Render service URL:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

Deploy the frontend, copy its production origin into Render's `CORS_ORIGINS`, then redeploy the backend. See the official [Render Express deployment guide](https://render.com/docs/deploy-node-express-app) and [Vercel Vite guide](https://vercel.com/docs/frameworks/frontend/vite).

## Studio workflow

- Add a client with a name and email, then add their shoot and schedule details.
- When the shoot is done, record the amount, currency, optional due date, and payment link or instructions. The app saves the completed shoot and payment record, then emails the payment request to the client email on file.
- If email delivery fails, retry from Payments. Mark payments received when payment arrives.
- Reports summarizes shoots and collections and exports the selected period as CSV.

## Build the admin app

From `mcue-frontend`, run `npm run build` to produce the Vite production bundle in `dist/`.
