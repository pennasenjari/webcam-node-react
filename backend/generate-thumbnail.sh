#!/bin/bash

# Paths
fullsize_path=$1
thumbnails_dir=/var/www/webcam/backend/thumbnails
thumbnail_path="$thumbnails_dir/$(basename "$fullsize_path")"

# Ensure the thumbnail directory exists
mkdir -p "$thumbnails_dir"

# Generate the thumbnail
convert "$fullsize_path" -resize 120x80 "$thumbnail_path"
