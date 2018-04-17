# 17-April-2018

### Implement configurable outbound mail scheme
```
process.env.OUTBOUND_MAIL [SES|SMTP|SENDMAIL]
process.env.SES_KEY_ID
process.env.SES_KEY
process.env.OUTBOUND_MAIL_SENDMAIL_PATH (/usr/sbin/sendmail)
process.env.OUTBOUND_MAIL_SMTP_HOST (25)
process.env.OUTBOUND_MAIL_SMTP_PORT
process.env.OUTBOUND_MAIL_SMTP_USER
process.env.OUTBOUND_MAIL_SMTP_PASSWORD
process.env.OUTBOUND_MAIL_RETURN_ADDRESS
```
