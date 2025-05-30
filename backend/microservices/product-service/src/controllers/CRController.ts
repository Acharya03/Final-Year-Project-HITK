import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getUserIdFromProduct, getUserDetails } from '../utils/userUtils';

const prisma = new PrismaClient();

// Get all comments for a product
export const getComments = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    console.log("productId", productId);

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const userId = await getUserIdFromProduct(productId);
    if (!userId) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const comments = await prisma.comment.findMany({
      where: {
        productId,
        parentId: null // Only get top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile_image_url: true,
            role: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profile_image_url: true,
                role: true
              }
            },
            _count: {
              select: {
                likes: true
              }
            }
          }
        },
        _count: {
          select: {
            likes: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

// Add a new comment
export const createComment = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { content, userId } = req.body; // Get userId from request body

    if (!productId || !content || !userId) {
      return res.status(400).json({ error: 'Product ID, content, and user ID are required' });
    }

    // Verify the product exists
    const productExists = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!productExists) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Verify the user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        productId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile_image_url: true,
            role: true
          }
        },
        _count: {
          select: {
            likes: true
          }
        }
      }
    });

    return res.json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
};

// Add a reply to a comment
export const createReply = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content, userId } = req.body; // Get userId from request body

    if (!commentId || !content || !userId) {
      return res.status(400).json({ error: 'Comment ID, content, and user ID are required' });
    }

    // Get parent comment
    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!parentComment) {
      return res.status(404).json({ error: 'Parent comment not found' });
    }

    const reply = await prisma.comment.create({
      data: {
        content,
        userId,
        productId: parentComment.productId,
        parentId: commentId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile_image_url: true,
            role: true
          }
        },
        _count: {
          select: {
            likes: true
          }
        }
      }
    });

    return res.json(reply);
  } catch (error) {
    console.error('Error creating reply:', error);
    return res.status(500).json({ error: 'Failed to create reply' });
  }
};

// Toggle like on a comment
export const toggleLike = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body; // Get userId from request body

    if (!commentId || !userId) {
      return res.status(400).json({ error: 'Comment ID and user ID are required' });
    }

    const existingLike = await prisma.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId
        }
      }
    });

    if (existingLike) {
      await prisma.commentLike.delete({
        where: {
          commentId_userId: {
            commentId,
            userId
          }
        }
      });
    } else {
      await prisma.commentLike.create({
        data: {
          commentId,
          userId
        }
      });
    }

    const updatedComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        _count: {
          select: {
            likes: true
          }
        }
      }
    });

    return res.json({
      likes: updatedComment?._count.likes,
      isLiked: !existingLike
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
};

export const getReports = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    
    const where: any = {};
    if (type) {
      where.type = type;
    }

    const reports = await prisma.report.findMany({
      where,
      include: {
        reportedBy: {
          select: {
            id: true,
            name: true,
            profile_image_url: true,
            role: true,
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            images: true,
          }
        },
        comment: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// Update report status
export const updateReport = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { status, resolvedById } = req.body;

    if (!status || !resolvedById) {
      return res.status(400).json({ error: 'Status and resolver ID are required' });
    }

    // Validate status
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get the report to check its type
    const report = await prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Start a transaction to update report and related content
    const updatedReport = await prisma.$transaction(async (prisma) => {
      // Update the report status
      const report = await prisma.report.update({
        where: { id: reportId },
        data: {
          status,
          resolvedById,
          resolvedAt: new Date()
        },
        include: {
          reportedBy: true,
          product: true,
          comment: true,
          resolvedBy: true
        }
      });

      // If rejected, handle the reported content
      if (status === 'REJECTED') {
        if (report.type === 'PRODUCT') {
          // Update product status or handle product rejection
          if (report.productId !== null) {
            await prisma.product.update({
              where: { id: report.productId },
              data: {
                isApproved: false
              }
            });
          }
        } else if (report.type === 'COMMENT') {
          // Delete the reported comment
          if (report.commentId !== null) {
            await prisma.comment.delete({
              where: { id: report.commentId }
            });
          }
        }
      }

      return report;
    });

    return res.json(updatedReport);
  } catch (error) {
    console.error('Error updating report:', error);
    return res.status(500).json({ error: 'Failed to update report' });
  }
};

// Get report details
export const getReportDetails = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reportedBy: {
          select: {
            id: true,
            name: true,
            profile_image_url: true,
            role: true,
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            images: true,
          }
        },
        comment: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.json(report);
  } catch (error) {
    console.error('Error fetching report details:', error);
    return res.status(500).json({ error: 'Failed to fetch report details' });
  }
};