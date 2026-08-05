import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { ScopedResource } from './scope-policy.service';

export const RESOURCE_TYPES = ['AcademicPeriod', 'LetterRequest'] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

@Injectable()
export class ResourceScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getScopedResource(type: ResourceType, id: string): Promise<ScopedResource | null> {
    switch (type) {
      case 'AcademicPeriod': {
        const period = await this.prisma.academicPeriod.findUnique({ where: { id } });
        return period === null ? null : { campusId: period.campusId };
      }
      case 'LetterRequest': {
        const letter = await this.prisma.letterRequest.findUnique({
          where: { id },
          include: { studentProfile: { select: { userId: true } } },
        });
        return letter === null
          ? null
          : {
              campusId: letter.campusId,
              schoolId: letter.schoolId,
              ownerId: letter.studentProfile.userId,
            };
      }
    }
  }
}
