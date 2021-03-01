module github.com/pulumi/pulumi/tests

go 1.15

replace (
	github.com/pulumi/pulumi/pkg/v2 => ../pkg
	github.com/pulumi/pulumi/sdk/v2 => ../sdk
)

require (
	github.com/blang/semver v3.5.1+incompatible
	github.com/pkg/errors v0.9.1
	github.com/pulumi/pulumi-random/sdk/v2 v2.4.2
	github.com/pulumi/pulumi/pkg/v2 v2.0.0
	github.com/pulumi/pulumi/sdk/v2 v2.2.1
	github.com/stretchr/testify v1.6.1
)
