# 22-April-2018

# 21-April-2018

UI Speed - embed OG JSON where possible to avoid async download latency

Badge counter & new notification UI enhancements

# 19-April-2018

Shorter negative cache for remote profiles "unknown user."

Mobile notifications view. Static footer nav for mobile.

# 18-April-2018

Activity feed descriptions more... descriptive.

Added 'description' to post extracted from post body to provide more context to activity items.

# 17-April-2018

### Rationalize AWS environment configuration

The instance iAM role is now the preferred way of granting permissions to AWS services when running on AWS.

If using these services the Instance role should be granted permission to:
- ses:SendEmail
- ses:SendRawEmail
- s3:PutObject
- s3:DeleteObject

If not using instance role permissions, use S3 iAM credentials:
- process.env.AWS_S3_KEY
- process.env.AWS_S3_KEY_ID

Always required if using S3
- process.env.AWS_S3_REGION
- process.env.AWS_S3_BUCKET

Alternately use an AWS config file:
- process.env.AWS_CONFIG

### Implement configurable outbound mail scheme
```
process.env.OUTBOUND_MAIL [SES|SMTP|SENDMAIL]
process.env.OUTBOUND_MAIL_SENDMAIL_PATH (/usr/sbin/sendmail)
process.env.OUTBOUND_MAIL_SMTP_HOST (25)
process.env.OUTBOUND_MAIL_SMTP_PORT
process.env.OUTBOUND_MAIL_SMTP_USER
process.env.OUTBOUND_MAIL_SMTP_PASSWORD
process.env.OUTBOUND_MAIL_RETURN_ADDRESS

If not using instance role permissions, provide SES iAM credentials:
process.env.AWS_SES_KEY_ID
process.env.AWS_SES_KEY
```
