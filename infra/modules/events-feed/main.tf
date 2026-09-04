terraform {
  required_version = "~> 1.16.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.62.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7.0"
    }
  }
}

locals {
  feed_bucket_name = "${var.name}-events-${var.aws_account_id}"
  logs_bucket_name = "${var.name}-events-logs-${var.aws_account_id}"
  origin_id        = "s3-${local.feed_bucket_name}"
  ghl_sync_source = replace(
    file("${path.module}/../../../scripts/lib/ghl-events-sync.mjs"),
    "from '../../src/scripts/events-calendar.js'",
    "from './events-calendar.js'",
  )
  lambda_sync_source = replace(
    file("${path.module}/../../functions/events-sync/sync.mjs"),
    "from '../../../scripts/lib/ghl-events-sync.mjs'",
    "from './ghl-events-sync.mjs'",
  )
}

check "lambda_zip_rewrites_imports" {
  assert {
    condition = (
      strcontains(local.ghl_sync_source, "from './events-calendar.js'") &&
      strcontains(local.lambda_sync_source, "from './ghl-events-sync.mjs'") &&
      !strcontains(local.ghl_sync_source, "from '../../src/scripts/events-calendar.js'") &&
      !strcontains(local.lambda_sync_source, "from '../../../scripts/lib/ghl-events-sync.mjs'")
    )
    error_message = "The events-sync zip import rewrite no longer matches the source files."
  }
}

data "archive_file" "events_sync" {
  type        = "zip"
  output_path = "${path.module}/../../functions/events-sync/events-sync.zip"

  source {
    content  = file("${path.module}/../../functions/events-sync/index.mjs")
    filename = "index.mjs"
  }

  source {
    content  = local.lambda_sync_source
    filename = "sync.mjs"
  }

  source {
    content  = local.ghl_sync_source
    filename = "ghl-events-sync.mjs"
  }

  source {
    content  = file("${path.module}/../../../src/scripts/events-calendar.js")
    filename = "events-calendar.js"
  }

  source {
    content  = file("${path.module}/../../functions/events-sync/package.json")
    filename = "package.json"
  }
}
