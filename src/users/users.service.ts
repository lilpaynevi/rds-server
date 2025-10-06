import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: User) {
    const existingUser = await this.findByUsername(createUserDto.email);
    if (existingUser) {
      throw new BadRequestException('email existe deja ');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = {
      ...createUserDto,
      password: hashedPassword,
    };

    return this.prisma.user.create({
      data: newUser,
    });
  }

  register(createUserDto: any) {
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  async findByUsername(email: User['email']): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByEmail(email: User['email']): Promise<User | null> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: {
        email,
      },
    });

    if (!user) {
      console.log(`Aucun compte trouvé avec l'adresse e-mail ${email}`);
      return null;
    }

    return user;
  }

  findAll() {
    return this.prisma.user.findMany({
      where: {
        roles: "USER"
      },
      include: {
        televisions: {
          include: {
            playlists: true,
          },
        },
        playlists: {
          include: {
            items: {
              include: {
                media: {
                  include: {
                    _count: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            medias: true,
            televisions: true,
            playlists: true
          }
        }
      },
    });
  }

  findAllNotVerified() {
    return this.prisma.user.findMany({
      where: {
        AND: {
          isVerify: false,
          isActive: true,
        },
      },
    });
  }

  async VerifiedUser(userId, isVerify) {
    return this.prisma.user.updateMany({
      data: {
        isVerify,
      },
      where: {
        id: userId,
      },
    });
  }

  async findOne(id: User['id']) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        televisions: true,
        playlists: true,
        Subscription: {
          include: {
            plan: true
          }
        },
      },
    });

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  update(id: User['id'], updateUserDto: any) {
    return this.prisma.user.updateMany({
      data: updateUserDto,
      where: {
        id,
      },
    });
  }

  remove(id: User['id']) {
    return this.prisma.user.deleteMany({
      where: {
        id,
      },
    });
  }
}
