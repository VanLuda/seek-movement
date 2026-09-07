# Connecting the survey and waiver forms (Formspree)

The survey (`/survey/`) and standalone waiver (`/release/`) pages show "This form is not
connected yet" until a form endpoint is set. Formspree receives the submissions and emails
them to you. Free plan: 50 submissions a month. About 10 minutes total.

## 1. Create the form (5 min)

1. Go to https://formspree.io and sign up with the email that should receive submissions.
2. Click **New form**. Name it `Seek Movement website`. Leave the default settings.
3. Copy the form endpoint. It looks like `https://formspree.io/f/abcdwxyz`.

## 2. Put the endpoint in the site (2 min)

1. Open `src/_data/site.json` in this repo.
2. Find this block and paste the endpoint between the quotes:

   ```json
   "forms": {
     "endpoint": "https://formspree.io/f/abcdwxyz"
   }
   ```

3. Commit and push:

   ```bash
   cd ~/Sites/seek-movement
   git add src/_data/site.json
   git commit -m "Connect survey and waiver forms to Formspree"
   git push
   ```

   The site redeploys on its own in about a minute.

## 3. Test (2 min)

1. Open https://seekmovement.org/survey/, fill it in, submit.
2. The first submission from a new site triggers a one-time **confirmation email** from
   Formspree. Click the link in it.
3. Submit once more. You should get the answers by email and see them in the Formspree
   dashboard.

Both forms send to the same endpoint. Each submission includes a `_form` field
(`survey` or `release`) and a `_subject` line so you can tell them apart or set up a
filter in your mail app.

## If you'd rather remove the forms

Delete `src/survey.njk` and `src/release.njk`, commit, push. The pages disappear and
nothing else changes. The registration checkout already captures the waiver consents.
