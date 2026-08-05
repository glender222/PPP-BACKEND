import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { ScopedResource } from './scope-policy.service';

export const RESOURCE_TYPES = [
  'AcademicPeriod',
  'LetterRequest',
  'Practice',
  'Document',
  'DocumentVersion',
] as const;

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
      case 'Practice': {
        const practice = await this.prisma.practice.findUnique({
          where: { id },
          include: {
            studentProfile: { select: { userId: true } },
            campusSchool: { select: { campusId: true, schoolId: true } },
          },
        });
        return practice === null
          ? null
          : {
              campusId: practice.campusSchool.campusId,
              schoolId: practice.campusSchool.schoolId,
              ownerId: practice.studentProfile.userId,
            };
      }
      case 'Document': {
        const document = await this.prisma.document.findUnique({
          where: { id },
          include: {
            requirementSnapshot: {
              include: {
                practice: {
                  include: {
                    studentProfile: { select: { userId: true } },
                    campusSchool: { select: { campusId: true, schoolId: true } },
                  },
                },
              },
            },
          },
        });
        if (document === null) {
          return null;
        }
        const practice = document.requirementSnapshot.practice;
        return {
          campusId: practice.campusSchool.campusId,
          schoolId: practice.campusSchool.schoolId,
          ownerId: practice.studentProfile.userId,
        };
      }
      case 'DocumentVersion': {
        const version = await this.prisma.documentVersion.findUnique({
          where: { id },
          include: {
            document: {
              include: {
                requirementSnapshot: {
                  include: {
                    practice: {
                      include: {
                        studentProfile: { select: { userId: true } },
                        campusSchool: { select: { campusId: true, schoolId: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (version === null) {
          return null;
        }
        const practice = version.document.requirementSnapshot.practice;
        return {
          campusId: practice.campusSchool.campusId,
          schoolId: practice.campusSchool.schoolId,
          ownerId: practice.studentProfile.userId,
        };
      }
    }
  }
}
