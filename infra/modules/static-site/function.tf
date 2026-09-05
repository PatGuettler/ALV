resource "aws_cloudfront_function" "directory_rewrite" {
  name    = replace(var.origin_access_control_name, "-oac", "-dir")
  runtime = "cloudfront-js-2.0"
  comment = "Resolve Astro directory routes to index.html without S3 website hosting"
  publish = true
  code    = <<-EOF
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
      } else if (uri.lastIndexOf('.') < uri.lastIndexOf('/')) {
        request.uri = uri + '/index.html';
      }
      return request;
    }
  EOF
}
