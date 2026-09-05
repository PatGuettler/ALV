locals {
  github_org_repo = var.github_repository
}

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_deploy_assume" {
  statement {
    sid     = "GitHubOidc"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${local.github_org_repo}:environment:production",
        "repo:${local.github_org_repo}:ref:refs/heads/main",
      ]
    }
  }
}

resource "aws_iam_role" "github_site_deploy" {
  name               = "${local.resource_prefix}-github-site-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_deploy_assume.json
}

data "aws_iam_policy_document" "github_site_s3" {
  statement {
    sid    = "UploadReleaseObjects"
    effect = "Allow"
    actions = [
      "s3:AbortMultipartUpload",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = ["arn:aws:s3:::${local.site_bucket_name}/*"]
  }

  statement {
    sid       = "ListOriginBucket"
    effect    = "Allow"
    actions   = ["s3:GetBucketLocation", "s3:ListBucket"]
    resources = ["arn:aws:s3:::${local.site_bucket_name}"]
  }
}

resource "aws_iam_role_policy" "github_site_s3" {
  name   = "${local.resource_prefix}-github-site-s3"
  role   = aws_iam_role.github_site_deploy.id
  policy = data.aws_iam_policy_document.github_site_s3.json
}

data "aws_iam_policy_document" "github_site_cloudfront" {
  statement {
    sid     = "InvalidateMutablePaths"
    effect  = "Allow"
    actions = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation", "cloudfront:ListInvalidations"]
    resources = [
      "arn:aws:cloudfront::${var.aws_account_id}:distribution/${module.static_site.distribution.id}",
    ]
  }
}

resource "aws_iam_role_policy" "github_site_cloudfront" {
  name   = "${local.resource_prefix}-github-site-cloudfront"
  role   = aws_iam_role.github_site_deploy.id
  policy = data.aws_iam_policy_document.github_site_cloudfront.json
}
