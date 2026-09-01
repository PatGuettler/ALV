# Public domain and certificate

This module requests the ALV CloudFront certificate in `us-east-1`, proves ownership through the
approved public Route 53 zone, waits for validation, and manages A/AAAA aliases for every approved
hostname. It does not create, import, or replace the hosted zone.

The caller supplies the CloudFront domain and hosted-zone ID exported by the static-site module.
Review the authoritative DNS export and cutover plan before applying; the module deliberately does
not manage unrelated records or registrar settings. Certificate replacement uses
`create_before_destroy` so an existing issued certificate remains available during renewal.
