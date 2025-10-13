import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOtpEmail(to: string, otp: string, studentId: string, transactionId?: string): Promise<void> {
    const mailOptions = {
      from: `"TDTU - Ibanking System" <${process.env.SMTP_USER}>`,
      to,
      subject: '🔐 Mã OTP xác thực giao dịch học phí - TDTU',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OTP Xác thực giao dịch</title>
          <!--[if mso]>
          <style type="text/css">
            body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
          </style>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
          
          <!-- Wrapper Table -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f7fa; padding: 40px 0;">
            <tr>
              <td align="center">
                
                <!-- Main Container -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);">
                  
                  <!-- Header Section -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 48px 40px; text-align: center;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="text-align: center;">
                            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 12px 24px; border-radius: 50px; margin-bottom: 20px;">
                              <span style="color: #ffffff; font-size: 32px; line-height: 1;">🏛️</span>
                            </div>
                            <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                              TDTU iBanking
                            </h1>
                            <p style="color: rgba(255, 255, 255, 0.9); margin: 0; font-size: 15px; font-weight: 400;">
                              Hệ thống ngân hàng điện tử
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Content Section -->
                  <tr>
                    <td style="padding: 48px 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        
                        <!-- Title -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <h2 style="color: #1e293b; margin: 0; font-size: 24px; font-weight: 700; text-align: center; line-height: 1.3;">
                              Xác thực giao dịch học phí
                            </h2>
                          </td>
                        </tr>
                        
                        <!-- Greeting -->
                        <tr>
                          <td style="padding-bottom: 24px;">
                            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
                              Xin chào,
                            </p>
                          </td>
                        </tr>
                        
                        <!-- Student Info Card -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                              <tr>
                                <td style="padding: 20px 24px;">
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                      <td style="padding-bottom: 8px;">
                                        <p style="color: #64748b; font-size: 13px; margin: 0; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                                          Mã sinh viên
                                        </p>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <p style="color: #1e293b; font-size: 18px; margin: 0; font-weight: 700;">
                                          ${studentId}
                                        </p>
                                      </td>
                                    </tr>
                                    ${transactionId ? `
                                    <tr>
                                      <td style="padding-top: 16px; border-top: 1px solid #e2e8f0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="padding-bottom: 6px;">
                                              <p style="color: #64748b; font-size: 13px; margin: 0; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                                                Mã giao dịch
                                              </p>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td>
                                              <p style="color: #475569; font-size: 14px; margin: 0; font-family: 'Courier New', monospace; background-color: #ffffff; padding: 8px 12px; border-radius: 6px; display: inline-block; border: 1px solid #e2e8f0;">
                                                ${transactionId}
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    ` : ''}
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                        <!-- OTP Section -->
                        <tr>
                          <td style="padding-bottom: 16px;">
                            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0; text-align: center; font-weight: 500;">
                              Mã xác thực OTP của bạn
                            </p>
                          </td>
                        </tr>
                        
                        <!-- OTP Code Box -->
                        <tr>
                          <td style="padding-bottom: 40px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td align="center">
                                  <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px; text-align: center; border-radius: 16px; box-shadow: 0 4px 24px rgba(79, 70, 229, 0.25); display: inline-block; min-width: 280px;">
                                    <h1 style="color: #ffffff; font-size: 48px; margin: 0; letter-spacing: 16px; font-weight: 800; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); font-family: 'Courier New', monospace;">
                                      ${otp}
                                    </h1>
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                        <!-- Warning Box -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px;">
                              <tr>
                                <td style="padding: 24px;">
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                      <td style="padding-bottom: 12px;">
                                        <p style="color: #92400e; margin: 0; font-size: 16px; font-weight: 700;">
                                          ⚠️ Lưu ý quan trọng
                                        </p>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="padding: 6px 0;">
                                              <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.6;">
                                                • Mã OTP có hiệu lực trong <strong>2 phút</strong>
                                              </p>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td style="padding: 6px 0;">
                                              <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.6;">
                                                • <strong>KHÔNG</strong> chia sẻ mã OTP với bất kỳ ai
                                              </p>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td style="padding: 6px 0;">
                                              <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.6;">
                                                • Nếu không thực hiện giao dịch, vui lòng bỏ qua email
                                              </p>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td style="padding: 6px 0;">
                                              <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.6;">
                                                • Liên hệ hotline <strong>1900-xxxx</strong> nếu có thắc mắc
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                        <!-- Security Notice -->
                        <tr>
                          <td>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px;">
                              <tr>
                                <td style="padding: 20px 24px;">
                                  <p style="color: #065f46; margin: 0; font-size: 14px; line-height: 1.6;">
                                    <strong>🛡️ Bảo mật:</strong> TDTU iBanking không bao giờ yêu cầu bạn cung cấp mật khẩu hoặc mã OTP qua email hoặc điện thoại.
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer Section -->
                  <tr>
                    <td style="background-color: #1e293b; padding: 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        
                        <!-- University Name -->
                        <tr>
                          <td style="text-align: center; padding-bottom: 20px;">
                            <p style="color: #f1f5f9; margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">
                              Trường Đại học Tôn Đức Thắng
                            </p>
                            <p style="color: #94a3b8; margin: 0; font-size: 13px; line-height: 1.8;">
                              19 Nguyễn Hữu Thọ, Tân Phong, Quận 7, TP.HCM<br>
                              Hotline: <span style="color: #e2e8f0;">1900-xxxx</span> | Email: <span style="color: #e2e8f0;">support@tdtu.edu.vn</span>
                            </p>
                          </td>
                        </tr>
                        
                        <!-- Social Links -->
                        <tr>
                          <td style="text-align: center; padding: 20px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                            <a href="https://www.tdtu.edu.vn" style="color: #60a5fa; text-decoration: none; font-size: 14px; font-weight: 500;">
                              www.tdtu.edu.vn
                            </a>
                          </td>
                        </tr>
                        
                        <!-- Copyright -->
                        <tr>
                          <td style="text-align: center; padding-top: 20px;">
                            <p style="color: #64748b; margin: 0; font-size: 12px;">
                              © 2024 TDTU iBanking System. Tất cả quyền được bảo lưu.
                            </p>
                          </td>
                        </tr>
                        
                      </table>
                    </td>
                  </tr>
                  
                </table>
                
              </td>
            </tr>
          </table>
          
        </body>
        </html>
      `,
    };

    // For development/testing - just log the email instead of sending
    if (process.env.NODE_ENV === 'development' || !process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
      this.logger.log(`📧 [EMAIL SIMULATION] OTP Email would be sent to: ${to}`);
      this.logger.log(`📧 [EMAIL SIMULATION] Subject: ${mailOptions.subject}`);
      this.logger.log(`📧 [EMAIL SIMULATION] OTP: ${otp}`);
      this.logger.log(`📧 [EMAIL SIMULATION] Student ID: ${studentId}`);
      this.logger.log(`📧 [EMAIL SIMULATION] HTML Content: ${mailOptions.html.substring(0, 200)}...`);
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP email sent to ${to} for student ${studentId}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}:`, error);
      throw error;
    }
  }

  async sendErrorNotification(
    to: string,
    error: string,
    transactionId?: string,
  ): Promise<void> {
    const mailOptions = {
      from: `"TDTU - Ibanking System" <${process.env.SMTP_USER}>`,
      to,
      subject: '❌ Thông báo lỗi giao dịch - TDTU',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thông báo lỗi giao dịch</title>
          <!--[if mso]>
          <style type="text/css">
            body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
          </style>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
          
          <!-- Wrapper Table -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f7fa; padding: 40px 0;">
            <tr>
              <td align="center">
                
                <!-- Main Container -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);">
                  
                  <!-- Header Section -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 48px 40px; text-align: center;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="text-align: center;">
                            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 12px 24px; border-radius: 50px; margin-bottom: 20px;">
                              <span style="color: #ffffff; font-size: 32px; line-height: 1;">❌</span>
                            </div>
                            <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                              Thông báo lỗi giao dịch
                            </h1>
                            <p style="color: rgba(255, 255, 255, 0.9); margin: 0; font-size: 15px; font-weight: 400;">
                              Giao dịch gặp sự cố
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Content Section -->
                  <tr>
                    <td style="padding: 48px 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        
                        <!-- Greeting -->
                        <tr>
                          <td style="padding-bottom: 24px;">
                            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
                              Xin chào,
                            </p>
                          </td>
                        </tr>
                        
                        <!-- Error Message -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px; padding: 24px;">
                              <p style="color: #991b1b; margin: 0; font-size: 16px; line-height: 1.6; font-weight: 500;">
                                😔 <strong>Rất tiếc, giao dịch của bạn đã gặp sự cố và không thể hoàn thành.</strong>
                              </p>
                            </div>
                          </td>
                        </tr>
                        
                        <!-- Error Details -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                              <tr>
                                <td style="padding: 24px;">
                                  <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 18px; font-weight: 700;">
                                    Chi tiết lỗi
                                  </h3>
                                  
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                      <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="width: 40%;">
                                              <p style="color: #64748b; font-size: 14px; margin: 0; font-weight: 500;">
                                                Mô tả lỗi
                                              </p>
                                            </td>
                                            <td style="width: 60%;">
                                              <p style="color: #dc2626; font-size: 14px; margin: 0; font-weight: 600;">
                                                ${error}
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    ${transactionId ? `
                                    <tr>
                                      <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="width: 40%;">
                                              <p style="color: #64748b; font-size: 14px; margin: 0; font-weight: 500;">
                                                Mã giao dịch
                                              </p>
                                            </td>
                                            <td style="width: 60%;">
                                              <p style="color: #475569; font-size: 14px; margin: 0; font-family: 'Courier New', monospace;">
                                                ${transactionId}
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    ` : ''}
                                    <tr>
                                      <td style="padding: 8px 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="width: 40%;">
                                              <p style="color: #64748b; font-size: 14px; margin: 0; font-weight: 500;">
                                                Thời gian
                                              </p>
                                            </td>
                                            <td style="width: 60%;">
                                              <p style="color: #475569; font-size: 14px; margin: 0;">
                                                ${new Date().toLocaleString('vi-VN')}
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                        <!-- Next Steps -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 24px;">
                              <h4 style="color: #1e40af; margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">
                                📋 Bước tiếp theo
                              </h4>
                              <ul style="color: #1e40af; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                                <li>Vui lòng thử lại giao dịch sau ít phút</li>
                                <li>Kiểm tra kết nối internet và thông tin tài khoản</li>
                                <li>Liên hệ hotline <strong>1900-xxxx</strong> nếu vấn đề vẫn tiếp diễn</li>
                              </ul>
                            </div>
                          </td>
                        </tr>
                        
                        <!-- Security Notice -->
                        <tr>
                          <td>
                            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px 24px;">
                              <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6;">
                                <strong>🛡️ Lưu ý bảo mật:</strong> TDTU iBanking không bao giờ yêu cầu bạn cung cấp mật khẩu hoặc mã OTP qua email hoặc điện thoại.
                              </p>
                            </div>
                          </td>
                        </tr>
                        
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer Section -->
                  <tr>
                    <td style="background-color: #1e293b; padding: 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        
                        <!-- University Name -->
                        <tr>
                          <td style="text-align: center; padding-bottom: 20px;">
                            <p style="color: #f1f5f9; margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">
                              Trường Đại học Tôn Đức Thắng
                            </p>
                            <p style="color: #94a3b8; margin: 0; font-size: 13px; line-height: 1.8;">
                              19 Nguyễn Hữu Thọ, Tân Phong, Quận 7, TP.HCM<br>
                              Hotline: <span style="color: #e2e8f0;">1900-xxxx</span> | Email: <span style="color: #e2e8f0;">support@tdtu.edu.vn</span>
                            </p>
                          </td>
                        </tr>
                        
                        <!-- Social Links -->
                        <tr>
                          <td style="text-align: center; padding: 20px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                            <a href="https://www.tdtu.edu.vn" style="color: #60a5fa; text-decoration: none; font-size: 14px; font-weight: 500;">
                              www.tdtu.edu.vn
                            </a>
                          </td>
                        </tr>
                        
                        <!-- Copyright -->
                        <tr>
                          <td style="text-align: center; padding-top: 20px;">
                            <p style="color: #64748b; margin: 0; font-size: 12px;">
                              © 2024 TDTU iBanking System. Tất cả quyền được bảo lưu.
                            </p>
                          </td>
                        </tr>
                        
                      </table>
                    </td>
                  </tr>
                  
                </table>
                
              </td>
            </tr>
          </table>
          
        </body>
        </html>
      `,
    };

    // For development/testing - just log the email instead of sending
    if (process.env.NODE_ENV === 'development' || !process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
      this.logger.log(`📧 [EMAIL SIMULATION] Error Notification Email would be sent to: ${to}`);
      this.logger.log(`📧 [EMAIL SIMULATION] Subject: ${mailOptions.subject}`);
      this.logger.log(`📧 [EMAIL SIMULATION] Error: ${error}`);
      if (transactionId) {
        this.logger.log(`📧 [EMAIL SIMULATION] Transaction ID: ${transactionId}`);
      }
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Error notification sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send error notification to ${to}:`, error);
      throw error;
    }
  }

  // Generic email sending method
  async sendEmail(to: string, subject: string, text: string, context?: any): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">${subject}</h2>
          <div style="white-space: pre-line;">${text}</div>
          ${context ? `<div style="margin-top: 20px; padding: 10px; background-color: #f8f9fa; border-left: 4px solid #007bff;">
            <strong>Additional Information:</strong><br>
            ${JSON.stringify(context, null, 2)}
          </div>` : ''}
          <p style="margin-top: 20px;">Trân trọng,<br>Hệ thống iBanking TDTU</p>
        </div>
      `,
    };

    // For development/testing - just log the email instead of sending
    if (process.env.NODE_ENV === 'development' || !process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
      this.logger.log(`📧 [EMAIL SIMULATION] Email would be sent to: ${to}`);
      this.logger.log(`📧 [EMAIL SIMULATION] Subject: ${subject}`);
      this.logger.log(`📧 [EMAIL SIMULATION] Content: ${text}`);
      if (context) {
        this.logger.log(`📧 [EMAIL SIMULATION] Context: ${JSON.stringify(context)}`);
      }
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  async sendPaymentSuccessEmail(
    to: string, 
    paymentId: string, 
    studentId: string, 
    amount: string, 
    newBalance: number, 
    completedAt: string
  ): Promise<void> {
    const mailOptions = {
      from: `"TDTU - Ibanking System" <${process.env.SMTP_USER}>`,
      to,
      subject: '✅ Thanh toán học phí thành công - TDTU',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thanh toán thành công</title>
          <!--[if mso]>
          <style type="text/css">
            body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
          </style>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
          
          <!-- Wrapper Table -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f7fa; padding: 40px 0;">
            <tr>
              <td align="center">
                
                <!-- Main Container -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);">
                  
                  <!-- Header Section -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 48px 40px; text-align: center;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="text-align: center;">
                            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 12px 24px; border-radius: 50px; margin-bottom: 20px;">
                              <span style="color: #ffffff; font-size: 32px; line-height: 1;">✅</span>
                            </div>
                            <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                              Thanh toán thành công
                            </h1>
                            <p style="color: rgba(255, 255, 255, 0.9); margin: 0; font-size: 15px; font-weight: 400;">
                              Giao dịch học phí đã được xử lý
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Content Section -->
                  <tr>
                    <td style="padding: 48px 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        
                        <!-- Greeting -->
                        <tr>
                          <td style="padding-bottom: 24px;">
                            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
                              Xin chào,
                            </p>
                          </td>
                        </tr>
                        
                        <!-- Success Message -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; padding: 24px;">
                              <p style="color: #065f46; margin: 0; font-size: 16px; line-height: 1.6; font-weight: 500;">
                                🎉 <strong>Giao dịch thanh toán học phí của bạn đã được xử lý thành công!</strong>
                              </p>
                            </div>
                          </td>
                        </tr>
                        
                        <!-- Transaction Details -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                              <tr>
                                <td style="padding: 24px;">
                                  <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 18px; font-weight: 700;">
                                    Chi tiết giao dịch
                                  </h3>
                                  
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                      <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="width: 40%;">
                                              <p style="color: #64748b; font-size: 14px; margin: 0; font-weight: 500;">
                                                Mã sinh viên
                                              </p>
                                            </td>
                                            <td style="width: 60%;">
                                              <p style="color: #1e293b; font-size: 14px; margin: 0; font-weight: 600;">
                                                ${studentId}
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="width: 40%;">
                                              <p style="color: #64748b; font-size: 14px; margin: 0; font-weight: 500;">
                                                Mã giao dịch
                                              </p>
                                            </td>
                                            <td style="width: 60%;">
                                              <p style="color: #475569; font-size: 14px; margin: 0; font-family: 'Courier New', monospace;">
                                                ${paymentId}
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="width: 40%;">
                                              <p style="color: #64748b; font-size: 14px; margin: 0; font-weight: 500;">
                                                Số tiền
                                              </p>
                                            </td>
                                            <td style="width: 60%;">
                                              <p style="color: #1e293b; font-size: 16px; margin: 0; font-weight: 700;">
                                                ${parseFloat(amount).toLocaleString('vi-VN')} VNĐ
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="width: 40%;">
                                              <p style="color: #64748b; font-size: 14px; margin: 0; font-weight: 500;">
                                                Số dư còn lại
                                              </p>
                                            </td>
                                            <td style="width: 60%;">
                                              <p style="color: #059669; font-size: 16px; margin: 0; font-weight: 700;">
                                                ${parseFloat(String(newBalance)).toLocaleString('vi-VN')} VNĐ
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td style="padding: 8px 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                          <tr>
                                            <td style="width: 40%;">
                                              <p style="color: #64748b; font-size: 14px; margin: 0; font-weight: 500;">
                                                Thời gian
                                              </p>
                                            </td>
                                            <td style="width: 60%;">
                                              <p style="color: #475569; font-size: 14px; margin: 0;">
                                                ${new Date(completedAt).toLocaleString('vi-VN')}
                                              </p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                        <!-- Next Steps -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 24px;">
                              <h4 style="color: #1e40af; margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">
                                📋 Bước tiếp theo
                              </h4>
                              <ul style="color: #1e40af; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                                <li>Giao dịch đã được ghi nhận vào hệ thống</li>
                                <li>Bạn có thể kiểm tra lịch sử giao dịch trong ứng dụng</li>
                                <li>Liên hệ hotline nếu có thắc mắc về giao dịch</li>
                              </ul>
                            </div>
                          </td>
                        </tr>
                        
                        <!-- Security Notice -->
                        <tr>
                          <td>
                            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px 24px;">
                              <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6;">
                                <strong>🛡️ Lưu ý bảo mật:</strong> Nếu bạn không thực hiện giao dịch này, vui lòng liên hệ ngay với chúng tôi qua hotline <strong>1900-xxxx</strong>.
                              </p>
                            </div>
                          </td>
                        </tr>
                        
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer Section -->
                  <tr>
                    <td style="background-color: #1e293b; padding: 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        
                        <!-- University Name -->
                        <tr>
                          <td style="text-align: center; padding-bottom: 20px;">
                            <p style="color: #f1f5f9; margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">
                              Trường Đại học Tôn Đức Thắng
                            </p>
                            <p style="color: #94a3b8; margin: 0; font-size: 13px; line-height: 1.8;">
                              19 Nguyễn Hữu Thọ, Tân Phong, Quận 7, TP.HCM<br>
                              Hotline: <span style="color: #e2e8f0;">1900-xxxx</span> | Email: <span style="color: #e2e8f0;">support@tdtu.edu.vn</span>
                            </p>
                          </td>
                        </tr>
                        
                        <!-- Social Links -->
                        <tr>
                          <td style="text-align: center; padding: 20px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                            <a href="https://www.tdtu.edu.vn" style="color: #60a5fa; text-decoration: none; font-size: 14px; font-weight: 500;">
                              www.tdtu.edu.vn
                            </a>
                          </td>
                        </tr>
                        
                        <!-- Copyright -->
                        <tr>
                          <td style="text-align: center; padding-top: 20px;">
                            <p style="color: #64748b; margin: 0; font-size: 12px;">
                              © 2024 TDTU iBanking System. Tất cả quyền được bảo lưu.
                            </p>
                          </td>
                        </tr>
                        
                      </table>
                    </td>
                  </tr>
                  
                </table>
                
              </td>
            </tr>
          </table>
          
        </body>
        </html>
      `,
    };

    // For development/testing - just log the email instead of sending
    if (process.env.NODE_ENV === 'development' || !process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
      this.logger.log(`📧 [EMAIL SIMULATION] Payment Success Email would be sent to: ${to}`);
      this.logger.log(`📧 [EMAIL SIMULATION] Subject: ${mailOptions.subject}`);
    } else {
      await this.transporter.sendMail(mailOptions);
    }
  }
}

