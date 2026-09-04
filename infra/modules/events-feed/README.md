# Public events calendar feed

Pulls the AV Events Calendar from GoHighLevel on a one-minute EventBridge Scheduler (AWS minimum;
sub-minute rates are not supported) and writes a public JSON object to a private S3 origin. CloudFront
with Origin Access Control is the only read path. The GoHighLevel private integration token is never
placed in Terraform variables, Lambda environment variables, or the static site.

After apply, put the token into Secrets Manager using the `ghl_token_secret_name` output, then set
the GitHub Actions variable `PUBLIC_EVENTS_FEED_URL` to the `feed_url` output so staging Pages polls
this feed.
