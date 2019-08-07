// reference: https://docs.aws.amazon.com/lambda/latest/dg/with-s3-example.html

// dependencies
const async = require('async');
const AWS = require('aws-sdk');
const gm = require('gm').subClass({ imageMagick: true }); // Enable ImageMagick integration.

// constants
const MAX_WIDTH  = 50;
const MAX_HEIGHT = 50;

// get reference to S3 client
const s3 = new AWS.S3();

exports.handler = (event) => {
  // Read options from the event.
  let srcBucket = event.Records[0].s3.bucket.name;
  // Object key may have spaces or unicode non-ASCII characters.
  let srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));  
  let dstBucket = srcBucket + '-resize';
  let dstKey = 'resized-' + srcKey;

  let imageType = srcKey.match(/\.([^.]*)$/)[1].toLowerCase();

  // Download the image from S3, transform, and upload to a different S3 bucket.
  async.waterfall([
    function download(next) {
      // Download the image from S3 into a buffer.
      s3.getObject({
        Bucket: srcBucket,
        Key: srcKey
      },
      next);
    },
    function transform(response, next) {
      gm(response.Body).size(function(err, size) {
        // Infer the scaling factor to avoid stretching the image unnaturally.
        let widthMin = MAX_WIDTH / size.width;
        let heightMin = MAX_HEIGHT / size.height;
        let scalingFactor = Math.min(widthMin, heightMin);
        let width  = scalingFactor * size.width;
        let height = scalingFactor * size.height;

        // Transform the image buffer in memory.
        this.resize(width, height)
          .toBuffer(imageType, function(err, buffer) {
            err ? next(err) : next(null, response.ContentType, buffer);
          });
      });
    },
    function upload(contentType, data, next) {
      // Stream the transformed image to a different S3 bucket.
      s3.putObject({
        Bucket: dstBucket,
        Key: dstKey,
        Body: data,
        ContentType: contentType
      },
      next);
    }
  ]);
};
