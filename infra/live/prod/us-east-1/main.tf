locals {
  project_name    = "alabama-veteran"
  environment     = "prod"
  resource_prefix = "avl-${local.environment}"
  required_tags = {
    Project            = local.project_name
    Environment        = local.environment
    ManagedBy          = "terraform"
    Owner              = var.owner
    CostCenter         = var.cost_center
    DataClassification = var.data_classification
  }
}

# Workload modules remain deliberately unwired until their focused resource issues are implemented.
