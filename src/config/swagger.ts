import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: `${env.APP_NAME} API`,
      version: "1.0.0",
      description:
        `REST API for ${env.APP_NAME} e-commerce platform. Supports website (public) and admin endpoints.\n\n` +
        "**Base URLs:**\n" +
        "- Web routes: `/api/website/...`\n" +
        "- Admin routes: `/api/admin/...`",
      contact: {
        name: "Support",
        email: env.SUPPORT_EMAIL,
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "JWT access token from login/register. Include as `Authorization: Bearer <token>`",
        },
        CookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "userToken",
          description: "HTTP-only cookie set after login",
        },
        AdminCookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "adminToken",
          description: "HTTP-only admin cookie",
        },
        CsrfToken: {
          type: "apiKey",
          in: "header",
          name: "x-csrf-token",
          description: "CSRF token obtained from GET /api/admin/csrf-token",
        },
      },
      headers: {
        RateLimitRemaining: {
          schema: { type: "integer" },
          description: "Number of requests remaining in the current window",
        },
        RateLimitReset: {
          schema: { type: "integer" },
          description: "Unix timestamp when the rate limit window resets",
        },
        RetryAfter: {
          schema: { type: "integer" },
          description: "Seconds to wait before retrying",
        },
      },
      schemas: {
        // ── Response Wrappers ──
        ApiSuccess: {
          type: "object",
          properties: {
            _status: { type: "boolean", example: true },
            _message: { type: "string", example: "Data fetched successfully" },
            _data: { type: "object" },
          },
        },
        ApiFailure: {
          type: "object",
          properties: {
            _status: { type: "boolean", example: false },
            _message: { type: "string", example: "Error message" },
            _error: { type: "string" },
          },
        },
        UnauthorizedError: {
          type: "object",
          properties: {
            _status: { type: "boolean", example: false },
            _message: { type: "string", example: "Not authorized, no token" },
          },
        },
        ForbiddenError: {
          type: "object",
          properties: {
            _status: { type: "boolean", example: false },
            _message: { type: "string", example: "Forbidden: admin access required" },
          },
        },
        NotFoundError: {
          type: "object",
          properties: {
            _status: { type: "boolean", example: false },
            _message: { type: "string", example: "Resource not found" },
          },
        },
        InternalError: {
          type: "object",
          properties: {
            _status: { type: "boolean", example: false },
            _message: { type: "string", example: "Internal server error" },
          },
        },
        PaginationMeta: {
          type: "object",
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },

        // ── Auth / User ──
        RegisterInput: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "John Doe" },
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", format: "password", minLength: 6, example: "password123" },
          },
        },
        LoginInput: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", format: "password", example: "password123" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            _status: { type: "boolean", example: true },
            _message: { type: "string" },
            _data: { type: "object" },
            _token: { type: "string" },
          },
        },
        UserProfile: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            mobile: { type: "number" },
            avatar: { type: "string" },
            role: { type: "string", enum: ["user", "admin"] },
            address: {
              type: "object",
              properties: {
                street: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                pincode: { type: "number" },
                area: { type: "string" },
              },
            },
          },
        },
        ForgotPasswordInput: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
          },
        },
        VerifyOtpInput: {
          type: "object",
          required: ["otp", "token"],
          properties: {
            otp: { type: "string" },
            token: { type: "string" },
          },
        },
        ResetPasswordInput: {
          type: "object",
          required: ["newPassword"],
          properties: {
            newPassword: { type: "string", format: "password", minLength: 6 },
          },
        },
        ChangePasswordInput: {
          type: "object",
          required: ["oldPassword", "newPassword"],
          properties: {
            oldPassword: { type: "string", format: "password" },
            newPassword: { type: "string", format: "password", minLength: 6 },
          },
        },

        // ── Product ──
        Product: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            images: { type: "array", items: { type: "string" } },
            image: { type: "string" },
            price: { type: "number" },
            discount_price: { type: "number" },
            stock: { type: "integer" },
            description: { type: "string" },
            category: { type: "object" },
            subCategory: { type: "object" },
            subSubCategory: { type: "object" },
            colors: { type: "array", items: { $ref: "#/components/schemas/Color" } },
            material: { type: "object" },
            isNewArrival: { type: "boolean" },
            isBestSeller: { type: "boolean" },
            isFeatured: { type: "boolean" },
            isUpsell: { type: "boolean" },
            isGift: { type: "boolean" },
            rating: { type: "number" },
            reviewCount: { type: "integer" },
          },
        },

        // ── Cart ──
        CartItem: {
          type: "object",
          properties: {
            _id: { type: "string" },
            product: { $ref: "#/components/schemas/Product" },
            color: { type: "string" },
            quantity: { type: "integer" },
            itemTotal: { type: "number" },
          },
        },
        CartResponse: {
          type: "object",
          properties: {
            items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
            totalItems: { type: "integer" },
            totalPrice: { type: "number" },
          },
        },
        AddToCartInput: {
          type: "object",
          required: ["productId", "colorId"],
          properties: {
            productId: { type: "string" },
            quantity: { type: "integer", minimum: 1, default: 1 },
            colorId: { type: "string" },

          },
        },
        UpdateCartItemInput: {
          type: "object",
          required: ["quantity"],
          properties: {
            quantity: { type: "integer", minimum: 1 },
          },
        },

        // ── Wishlist ──
        WishlistItem: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            price: { type: "number" },
            discount_price: { type: "number" },
            image: { type: "string" },
            slug: { type: "string" },
          },
        },
        WishlistCheckResponse: {
          type: "object",
          properties: {
            isInWishlist: { type: "boolean" },
          },
        },

        // ── Review ──
        CreateReviewInput: {
          type: "object",
          required: ["productId", "rating", "comment"],
          properties: {
            productId: { type: "string" },
            rating: { type: "integer", minimum: 1, maximum: 5 },
            comment: { type: "string" },
          },
        },
        Review: {
          type: "object",
          properties: {
            _id: { type: "string" },
            userId: { type: "object" },
            productId: { type: "string" },
            rating: { type: "integer" },
            comment: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ── Order ──
        ShippingAddress: {
          type: "object",
          required: ["fullName", "phone", "email", "area", "street", "city", "state", "pincode"],
          properties: {
            fullName: { type: "string" },
            phone: { type: "string" },
            email: { type: "string", format: "email" },
            area: { type: "string" },
            street: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            pincode: { type: "string" },
          },
        },
        CreateOrderInput: {
          type: "object",
          required: ["purchaseType", "shippingAddress"],
          properties: {
            purchaseType: { type: "string", enum: ["cart", "direct"] },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: { type: "string" },
                  quantity: { type: "integer" },
                  colorId: { type: "string" },
      
                },
              },
            },
            shippingAddress: { $ref: "#/components/schemas/ShippingAddress" },
            billingAddress: { type: "object" },
            notes: { type: "string" },
            isGift: { type: "boolean" },
            giftMessage: { type: "string" },
            giftWrap: { type: "boolean" },
            isCodAdvance: { type: "boolean" },
            idempotencyKey: { type: "string" },
          },
        },
        CreateRazorpayOrderInput: {
          type: "object",
          required: ["orderId"],
          properties: {
            orderId: { type: "string" },
            isCodAdvance: { type: "boolean" },
          },
        },
        VerifyPaymentInput: {
          type: "object",
          required: ["razorpay_order_id", "razorpay_payment_id", "razorpay_signature", "orderId"],
          properties: {
            razorpay_order_id: { type: "string" },
            razorpay_payment_id: { type: "string" },
            razorpay_signature: { type: "string" },
            orderId: { type: "string" },
          },
        },
        Order: {
          type: "object",
          properties: {
            _id: { type: "string" },
            orderId: { type: "string" },
            userId: { type: "string" },
            status: { type: "string" },
            items: { type: "array", items: { type: "object" } },
            pricing: {
              type: "object",
              properties: {
                subtotal: { type: "number" },
                discount: { type: "object" },
                shipping: { type: "number" },
                total: { type: "number" },
                advance: { type: "number" },
              },
            },
            shippingAddress: { $ref: "#/components/schemas/ShippingAddress" },
            payment: { type: "object" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        CancelOrderInput: {
          type: "object",
          properties: {
            reason: { type: "string" },
          },
        },
        VerifyDeliveryOtpInput: {
          type: "object",
          required: ["orderId", "otp"],
          properties: {
            orderId: { type: "string" },
            otp: { type: "string" },
          },
        },

        // ── Banner ──
        Banner: {
          type: "object",
          properties: {
            _id: { type: "string" },
            image: { type: "string" },
            link: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["external", "product", "category", "subCategory", "subSubCategory"] },
                target: { type: "string" },
                url: { type: "string" },
                externalUrl: { type: "string" },
              },
            },
          },
        },

        // ── Categories / Navigation ──
        SubSubCategory: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            image: { type: "string" },
          },
        },
        SubCategory: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            image: { type: "string" },
            subSubCategories: { type: "array", items: { $ref: "#/components/schemas/SubSubCategory" } },
          },
        },
        Category: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            image: { type: "string" },
            subCategories: { type: "array", items: { $ref: "#/components/schemas/SubCategory" } },
          },
        },
        NavigationData: {
          type: "array",
          items: { $ref: "#/components/schemas/Category" },
        },

        // ── Misc ──
        Color: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            code: { type: "string" },
          },
        },
        Material: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
          },
        },
        FAQ: {
          type: "object",
          properties: {
            _id: { type: "string" },
            question: { type: "string" },
            answer: { type: "string" },
            order: { type: "integer" },
          },
        },
        Testimonial: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            content: { type: "string" },
            rating: { type: "integer" },
            image: { type: "string" },
          },
        },
        ContactInput: {
          type: "object",
          required: ["name", "email", "message"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            message: { type: "string" },
            phone: { type: "string" },
          },
        },
        HomePage: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  type: { type: "string" },
                  config: { type: "object" },
                  order: { type: "integer" },
                },
              },
            },
            version: { type: "integer" },
          },
        },
        Logo: {
          type: "object",
          properties: {
            _id: { type: "string" },
            image: { type: "string" },
            name: { type: "string" },
          },
        },
        WhyChooseUs: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            icon: { type: "string" },
          },
        },
        Coupon: {
          type: "object",
          properties: {
            _id: { type: "string" },
            code: { type: "string" },
            discount: { type: "number" },
            type: { type: "string", enum: ["percentage", "fixed"] },
            minAmount: { type: "number" },
            expiresAt: { type: "string", format: "date-time" },
          },
        },
        ProductFAQ: {
          type: "object",
          properties: {
            _id: { type: "string" },
            productId: { type: "string" },
            question: { type: "string" },
            answer: { type: "string" },
          },
        },
        SuggestionResponse: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  slug: { type: "string" },
                  image: { type: "string" },
                  discount_price: { type: "number" },
                },
              },
            },
          },
        },
        GoogleAuthInitResponse: {
          type: "object",
          properties: {
            _status: { type: "boolean", example: true },
            _state: { type: "string" },
            _url: { type: "string" },
          },
        },
        GoogleLoginInput: {
          type: "object",
          required: ["credential"],
          properties: {
            credential: { type: "string" },
          },
        },
        GoogleCallbackInput: {
          type: "object",
          required: ["code", "state"],
          properties: {
            code: { type: "string" },
            state: { type: "string" },
          },
        },

        // ── Admin ──
        AdminLoginInput: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "admin@example.com" },
            password: { type: "string", format: "password", example: "admin123" },
          },
        },
        AdminCreateUserInput: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", format: "password", minLength: 6 },
            mobile: { type: "string" },
            role: { type: "string", enum: ["user", "admin"] },
          },
        },
        AdminChangeRoleInput: {
          type: "object",
          required: ["role"],
          properties: {
            role: { type: "string", enum: ["user", "admin"] },
          },
        },
        AdminVerifyPasswordInput: {
          type: "object",
          required: ["password"],
          properties: {
            password: { type: "string", format: "password" },
          },
        },
        AdminDashboardStats: {
          type: "object",
          properties: {
            totalUsers: { type: "integer" },
            totalOrders: { type: "integer" },
            totalProducts: { type: "integer" },
            totalRevenue: { type: "number" },
            pendingOrders: { type: "integer" },
            recentOrders: { type: "array", items: { $ref: "#/components/schemas/Order" } },
          },
        },
        AdminRecentActivity: {
          type: "array",
          items: {
            type: "object",
            properties: {
              _id: { type: "string" },
              action: { type: "string" },
              entity: { type: "string" },
              entityId: { type: "string" },
              adminId: { type: "string" },
              details: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
        AuditLog: {
          type: "object",
          properties: {
            _id: { type: "string" },
            action: { type: "string" },
            entity: { type: "string" },
            entityId: { type: "string" },
            adminId: { type: "object", properties: { _id: { type: "string" }, name: { type: "string" }, email: { type: "string" } } },
            details: { type: "string" },
            ip: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        AdminProductInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" },
            discount_price: { type: "number" },
            stock: { type: "integer" },
            description: { type: "string" },
            category: { type: "string" },
            subCategory: { type: "string" },
            subSubCategory: { type: "string" },
            colors: { type: "array", items: { type: "string" } },
            material: { type: "string" },
            isNewArrival: { type: "boolean" },
            isBestSeller: { type: "boolean" },
            isFeatured: { type: "boolean" },
            isUpsell: { type: "boolean" },
            isGift: { type: "boolean" },
          },
        },
        AdminBannerInput: {
          type: "object",
          properties: {
            image: { type: "string", description: "Image URL (upload via multipart/form-data)" },
            link: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["external", "product", "category", "subCategory", "subSubCategory"] },
                target: { type: "string" },
                externalUrl: { type: "string" },
              },
            },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminCategoryInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            image: { type: "string", description: "Image URL (upload via multipart/form-data)" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminFaqInput: {
          type: "object",
          required: ["question", "answer"],
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
            order: { type: "integer" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminTestimonialInput: {
          type: "object",
          required: ["name", "content"],
          properties: {
            name: { type: "string" },
            content: { type: "string" },
            rating: { type: "integer", minimum: 1, maximum: 5 },
            image: { type: "string" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminLogoInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            image: { type: "string", description: "Logo image (upload via multipart/form-data)" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminWhyChooseUsInput: {
          type: "object",
          required: ["title", "description"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            icon: { type: "string" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminColorInput: {
          type: "object",
          required: ["name", "code"],
          properties: {
            name: { type: "string" },
            code: { type: "string", description: "Hex color code" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminMaterialInput: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminProductFaqInput: {
          type: "object",
          required: ["productId", "question", "answer"],
          properties: {
            productId: { type: "string" },
            question: { type: "string" },
            answer: { type: "string" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminStatusInput: {
          type: "object",
          required: ["status", "id"],
          properties: {
            id: { type: "string" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
        AdminBulkRefundInput: {
          type: "object",
          properties: {
            orderIds: { type: "array", items: { type: "string" } },
          },
        },
        AdminPendingPaymentInput: {
          type: "object",
          properties: {
            orderId: { type: "string" },
            paymentId: { type: "string" },
          },
        },
      },
    },
    paths: {},
  },
  apis: [
    process.env.NODE_ENV === "production"
      ? "./dist/routes/web/*.js"
      : "./src/routes/web/*.ts",
    process.env.NODE_ENV === "production"
      ? "./dist/routes/admin/*.js"
      : "./src/routes/admin/*.ts",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
