variable "name" {
  description = "Environment resource prefix used to name the events feed resources."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,24}$", var.name))
    error_message = "name must contain 3-24 lowercase letters, digits, or hyphens."
  }
}

variable "aws_account_id" {
  description = "Twelve-digit account that owns the feed bucket, distribution, and sync function."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must contain exactly 12 digits."
  }
}

variable "ghl_location_id" {
  description = "Public GoHighLevel location ID. Not a secret."
  type        = string

  validation {
    condition     = length(trimspace(var.ghl_location_id)) >= 8
    error_message = "ghl_location_id must be the GHL location identifier."
  }
}

variable "ghl_events_calendar_id" {
  description = "Public AV Events Calendar ID. Not a secret."
  type        = string

  validation {
    condition     = length(trimspace(var.ghl_events_calendar_id)) >= 8
    error_message = "ghl_events_calendar_id must be the GHL calendar identifier."
  }
}

variable "allowed_origins" {
  description = "Browser origins permitted to read the public events JSON feed."
  type        = list(string)

  validation {
    condition = (
      length(var.allowed_origins) > 0 &&
      alltrue([
        for origin in var.allowed_origins : can(regex("^https?://[^/]+$", origin))
      ])
    )
    error_message = "allowed_origins must be one or more scheme://host origins with no path."
  }
}

variable "feed_object_key" {
  description = "S3 object key and CloudFront path for the public events JSON feed."
  type        = string
  default     = "data/events-calendar.json"

  validation {
    condition     = can(regex("^[A-Za-z0-9._/-]+\\.json$", var.feed_object_key))
    error_message = "feed_object_key must be a JSON object key."
  }
}

variable "schedule_expression" {
  description = "EventBridge Scheduler rate expression. AWS minimum is one minute."
  type        = string
  default     = "rate(1 minute)"

  validation {
    condition     = can(regex("^rate\\(1 minute\\)$|^rate\\([1-9][0-9]* minutes\\)$", var.schedule_expression))
    error_message = "schedule_expression must be an EventBridge Scheduler rate of one minute or more."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the sync function."
  type        = number
  default     = 365

  validation {
    condition     = contains([90, 365, 400], var.log_retention_days)
    error_message = "log_retention_days must be an approved retention period."
  }
}

variable "tags" {
  description = "Required environment tags inherited from the live root."
  type        = map(string)
}
