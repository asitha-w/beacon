// Package web embeds the console so the binary is self-contained.
package web

import "embed"

// FS holds the static console files.
//
//go:embed index.html css js
var FS embed.FS
