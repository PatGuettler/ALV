locals {
  project_name    = "alabama-veteran"
  environment     = "nonprod"
  resource_prefix = "alv-${local.environment}"
  required_tags = {
    Project            = local.project_name
    Environment        = local.environment
    ManagedBy          = "terraform"
    Owner              = var.owner
    CostCenter         = var.cost_center
    DataClassification = var.data_classification
  }
}

module "events_feed" {
  source = "../../../modules/events-feed"

  name                   = local.resource_prefix
  aws_account_id         = var.aws_account_id
  ghl_location_id        = var.ghl_location_id
  ghl_events_calendar_id = var.ghl_events_calendar_id
  allowed_origins        = var.events_feed_allowed_origins
  tags                   = local.required_tags
}
