locals {
  project_name         = "alabama-veteran"
  environment          = "prod"
  resource_prefix      = "alv-${local.environment}"
  site_bucket_name     = "${local.resource_prefix}-${var.aws_account_id}-web"
  edge_log_bucket_name = "${local.resource_prefix}-${var.aws_account_id}-edge-logs"
  required_tags = {
    Project            = local.project_name
    Environment        = local.environment
    ManagedBy          = "terraform"
    Owner              = var.owner
    CostCenter         = var.cost_center
    DataClassification = var.data_classification
  }
}

# Workload modules: Warrior Retreat intake, S3/CloudFront public site, WAF, and launch alarms.
# Media originals/derivatives (#277) wait for an uploader role after this edge path is applied.
