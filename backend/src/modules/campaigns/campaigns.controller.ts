import type { NextFunction, Request, Response } from 'express';
import type { CreateCampaignInput, UpdateCampaignInput } from './campaigns.schema.js';
import {
  closeCampaign,
  createCampaign,
  getAdminCampaignById,
  getPublicCampaignBySlug,
  listAdminCampaigns,
  listPublicCampaigns,
  pauseCampaign,
  publishCampaign,
  updateCampaign,
} from './campaigns.service.js';

export async function listPublicCampaignsController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaigns = await listPublicCampaigns();
    res.status(200).json({ success: true, data: { campaigns } });
  } catch (error) {
    next(error);
  }
}

export async function getPublicCampaignBySlugController(
  req: Request<{ slug: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaign = await getPublicCampaignBySlug(req.params.slug);
    res.status(200).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
}

export async function listAdminCampaignsController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaigns = await listAdminCampaigns();
    res.status(200).json({ success: true, data: { campaigns } });
  } catch (error) {
    next(error);
  }
}

export async function getAdminCampaignByIdController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaign = await getAdminCampaignById(req.params.id);
    res.status(200).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
}

export async function createCampaignController(
  req: Request<unknown, unknown, CreateCampaignInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaign = await createCampaign(req.body, req.admin!.id);
    res.status(201).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
}

export async function updateCampaignController(
  req: Request<{ id: string }, unknown, UpdateCampaignInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaign = await updateCampaign(req.params.id, req.body, req.admin!.id);
    res.status(200).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
}

export async function publishCampaignController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaign = await publishCampaign(req.params.id, req.admin!.id);
    res.status(200).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
}

export async function pauseCampaignController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaign = await pauseCampaign(req.params.id, req.admin!.id);
    res.status(200).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
}

export async function closeCampaignController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaign = await closeCampaign(req.params.id, req.admin!.id);
    res.status(200).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
}
